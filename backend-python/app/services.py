from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.architecture.bus import bus
from app.architecture import email_templates
from app.architecture.mail import send_mail
from app.modules.challenges.domain.challenge import mark_phase_passed
from app.modules.risk.domain.risk import RiskInput, evaluate_risk
from app.persistence.models import (
    AuditEntry,
    BreachRecord,
    Challenge,
    EquitySnapshot,
    Notification,
    Order,
    Trade,
    TradingAccount,
    Trader,
    Wallet,
)
from app.shared_kernel.errors import DomainError


def _now() -> datetime:
    return datetime.now(timezone.utc)


def notify(session: Session, to_email: str, subject: str, body: str) -> None:
    status, detail = send_mail(to_email, subject, body)
    session.add(
        Notification(
            to_email=to_email,
            subject=subject,
            body=body,
            status=status,
            delivery_detail=detail or None,
        )
    )


def audit(session: Session, event_type: str, source: str, summary: str, payload: dict) -> None:
    session.add(
        AuditEntry(
            event_type=event_type,
            source=source,
            summary=summary,
            payload_json=json.dumps(payload),
        )
    )


def on_order_paid(session: Session, order: Order) -> Challenge:
    existing = session.scalar(select(Challenge).where(Challenge.order_id == order.id))
    if existing:
        return existing
    ch = Challenge(
        trader_id=order.trader_id,
        order_id=order.id,
        product_id=order.product_id,
        sku=order.sku,
        account_size=order.account_size,
        phases=order.phases,
        current_phase=1,
        profit_target_pct=order.profit_target_pct,
        phase1_target_pct=order.phase1_target_pct,
        phase2_target_pct=order.phase2_target_pct,
        daily_loss_pct=order.daily_loss_pct,
        max_loss_pct=order.max_loss_pct,
        min_trading_days=order.min_trading_days,
        status="Active",
    )
    session.add(ch)
    session.flush()
    short = uuid.uuid4().hex[:8]
    platform = order.platform or "mt5"
    servers = {
        "mt5": "PropFirm-Demo-MT5",
        "matchtrader": "PropFirm-MatchTrader",
        "ctrader": "PropFirm-cTrader",
    }
    login = f"1000{short[:5]}" if platform == "mt5" else f"{platform[:2]}_{short}"
    acc = TradingAccount(
        challenge_id=ch.id,
        trader_id=order.trader_id,
        login=login,
        password=f"Pwd_{short[:6]}!",
        platform=platform,
        server=servers.get(platform, "PropFirm-Demo-MT5"),
        starting_balance=order.account_size,
        equity=order.account_size,
        high_water_mark=order.account_size,
        locked=False,
    )
    session.add(acc)
    session.flush()
    trader = session.get(Trader, order.trader_id)
    if trader:
        paid_at = (order.paid_at or _now()).isoformat()
        subject, body = email_templates.purchase_invoice_and_credentials(
            display_name=trader.display_name,
            order_id=order.id,
            sku=order.sku,
            price=float(order.price),
            account_size=float(order.account_size),
            platform=acc.platform,
            server=acc.server,
            login=acc.login,
            password=acc.password,
            challenge_id=ch.id,
            paid_at=paid_at,
        )
        notify(session, trader.email, subject, body)
    audit(session, "ChallengeStarted", "trading", f"Account provisioned for {ch.id}", {"challengeId": ch.id})
    return ch


def simulate_trade(
    session: Session,
    challenge_id: str,
    symbol: str,
    side: str,
    lots: float,
    pnl: float,
    trade_day: str | None = None,
) -> dict:
    ch = session.get(Challenge, challenge_id)
    if not ch:
        raise DomainError("not found")
    if ch.status != "Active":
        raise DomainError("challenge not active")
    acc = session.scalar(select(TradingAccount).where(TradingAccount.challenge_id == challenge_id))
    if not acc:
        raise DomainError("account not found")
    if acc.locked:
        raise DomainError("account locked")

    trade_at = _now()
    if trade_day:
        try:
            d = date.fromisoformat(trade_day)
            trade_at = datetime(d.year, d.month, d.day, 15, 0, 0, tzinfo=timezone.utc)
        except ValueError as exc:
            raise DomainError("invalid tradeDay") from exc

    acc.equity = round(float(acc.equity) + pnl, 2)
    if acc.equity > acc.high_water_mark:
        acc.high_water_mark = acc.equity

    trade = Trade(
        account_id=acc.id,
        challenge_id=challenge_id,
        symbol=symbol or "EURUSD",
        side=side or "buy",
        lots=lots or 1,
        pnl=pnl,
        equity_after=acc.equity,
        created_at=trade_at,
    )
    session.add(trade)
    session.flush()

    today = date.today()
    day_pnl = session.scalar(
        select(func.coalesce(func.sum(Trade.pnl), 0)).where(
            Trade.challenge_id == challenge_id,
            func.date(Trade.created_at) == today,
        )
    )
    trading_days = session.scalar(
        select(func.count(func.distinct(func.date(Trade.created_at)))).where(Trade.challenge_id == challenge_id)
    )
    day_pnl = float(day_pnl or 0)
    trading_days = int(trading_days or 0)
    session.add(
        EquitySnapshot(
            challenge_id=challenge_id,
            equity=acc.equity,
            day_pnl=day_pnl,
            trading_days=trading_days,
            created_at=trade_at,
        )
    )

    target_pct = ch.phase1_target_pct if ch.current_phase <= 1 else ch.phase2_target_pct
    if not target_pct:
        target_pct = ch.profit_target_pct
    result = evaluate_risk(
        RiskInput(
            starting_balance=acc.starting_balance,
            equity=acc.equity,
            day_pnl=day_pnl,
            trading_days=trading_days,
            profit_target_pct=target_pct,
            daily_loss_pct=ch.daily_loss_pct,
            max_loss_pct=ch.max_loss_pct,
            min_trading_days=ch.min_trading_days,
        )
    )

    status = ch.status
    email_status = None
    if result.kind == "breach":
        ch.status = "Failed"
        ch.fail_reason = result.reason
        acc.locked = True
        session.add(BreachRecord(challenge_id=challenge_id, rule=result.rule, reason=result.reason))
        trader = session.get(Trader, ch.trader_id)
        if trader:
            subject, body = email_templates.account_breach(
                display_name=trader.display_name,
                challenge_id=challenge_id,
                sku=ch.sku,
                rule=result.rule,
                reason=result.reason,
                login=acc.login,
                equity=float(acc.equity),
            )
            # Flush breach state first, then send mail immediately.
            session.flush()
            notify(session, trader.email, subject, body)
            email_status = "sent"
        status = "Failed"
        audit(
            session,
            "ChallengeFailed",
            "risk",
            f"{result.rule}: {result.reason}",
            {"challengeId": challenge_id, "rule": result.rule, "reason": result.reason},
        )
    elif result.kind == "target":
        outcome, new_phase, new_status, new_target = mark_phase_passed(
            ch.current_phase, ch.phases, ch.status, ch.phase2_target_pct
        )
        if outcome == "advanced":
            ch.current_phase = new_phase
            ch.profit_target_pct = new_target
            acc.equity = ch.account_size
            acc.starting_balance = ch.account_size
            acc.high_water_mark = ch.account_size
            acc.locked = False
            status = "Active"
            trader = session.get(Trader, ch.trader_id)
            if trader:
                notify(
                    session,
                    trader.email,
                    "Challenge phase passed",
                    f"Challenge {challenge_id} passed phase {new_phase - 1}. Phase {new_phase} starts now.",
                )
        else:
            ch.status = "Funded"
            credit = ch.account_size * 0.1
            wallet = session.get(Wallet, ch.trader_id)
            if not wallet:
                wallet = Wallet(trader_id=ch.trader_id, available_balance=0)
                session.add(wallet)
                session.flush()
            wallet.available_balance = float(wallet.available_balance) + credit
            wallet.updated_at = _now()
            trader = session.get(Trader, ch.trader_id)
            if trader:
                notify(
                    session,
                    trader.email,
                    "You are funded!",
                    f"Challenge {challenge_id} is Funded. Wallet credited ${credit:.2f}.",
                )
            status = "Funded"

    payload = {
        "trade": {
            "id": trade.id,
            "symbol": trade.symbol,
            "side": trade.side,
            "lots": trade.lots,
            "pnl": trade.pnl,
            "equityAfter": trade.equity_after,
            "createdAt": trade.created_at,
        },
        "equity": acc.equity,
        "challengeStatus": status,
        "failReason": ch.fail_reason,
        "breachRule": result.rule if result.kind == "breach" else None,
        "emailNotified": email_status,
    }
    return payload


def wire_bus() -> None:
    # Bus handlers for audit-style events can be extended; order paid is invoked directly.
    bus.subscribe("noop", lambda _e: None)
