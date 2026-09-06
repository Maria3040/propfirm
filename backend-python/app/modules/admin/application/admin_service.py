"""Admin application services — use-case orchestration (no HTTP)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.architecture.cache import invalidate_catalog
from app.architecture import email_templates
from app.modules.payouts.domain.ip_risk import (
    ConnectionSnapshot,
    assess_ip_risk,
    can_approve_payout,
)
from app.persistence.models import (
    AuditEntry,
    Challenge,
    LoginHistory,
    Notification,
    Order,
    PayoutRequest,
    Product,
    Trader,
    TradingAccount,
    Wallet,
)
from app.services import audit, notify
from app.shared_kernel.errors import DomainError
from app.shared_kernel.list_query import (
    ListParams,
    apply_sort,
    fetch_page,
    page_envelope,
    parse_list_params,
)


def overview(session: Session) -> dict[str, Any]:
    return {
        "traders": session.scalar(select(func.count()).select_from(Trader)) or 0,
        "challengesActive": session.scalar(
            select(func.count()).select_from(Challenge).where(Challenge.status == "Active")
        )
        or 0,
        "challengesFunded": session.scalar(
            select(func.count()).select_from(Challenge).where(Challenge.status == "Funded")
        )
        or 0,
        "challengesFailed": session.scalar(
            select(func.count()).select_from(Challenge).where(Challenge.status == "Failed")
        )
        or 0,
        "payoutsPending": session.scalar(
            select(func.count()).select_from(PayoutRequest).where(PayoutRequest.status == "Pending")
        )
        or 0,
        "payoutsNeedsVpsInvoice": session.scalar(
            select(func.count())
            .select_from(PayoutRequest)
            .where(PayoutRequest.status == "NeedsVpsInvoice")
        )
        or 0,
        "ordersPaid": session.scalar(
            select(func.count()).select_from(Order).where(Order.status == "Paid")
        )
        or 0,
        "productsActive": session.scalar(
            select(func.count()).select_from(Product).where(Product.is_active.is_(True))
        )
        or 0,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


def _params(
    *,
    page: int = 1,
    page_size: int = 20,
    q: str | None = None,
    sort_by: str = "createdAt",
    sort_dir: str = "desc",
    default_sort: str = "createdAt",
) -> ListParams:
    return parse_list_params(
        page=page,
        page_size=page_size,
        q=q,
        sort_by=sort_by,
        sort_dir=sort_dir,
        default_sort=default_sort,
    )


def list_traders(
    session: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    q: str | None = None,
    sort_by: str = "createdAt",
    sort_dir: str = "desc",
    role: str | None = None,
) -> dict[str, Any]:
    params = _params(page=page, page_size=page_size, q=q, sort_by=sort_by, sort_dir=sort_dir)
    stmt = select(Trader)
    filters: dict[str, Any] = {}
    if role:
        stmt = stmt.where(Trader.role == role)
        filters["role"] = role
    if params.q:
        like = f"%{params.q}%"
        stmt = stmt.where(or_(Trader.email.ilike(like), Trader.display_name.ilike(like)))
    sort_map = {
        "createdAt": Trader.created_at,
        "email": Trader.email,
        "displayName": Trader.display_name,
        "role": Trader.role,
    }
    stmt = apply_sort(stmt, sort_map, params, default_key="createdAt")
    rows, total = fetch_page(session, stmt, params)
    items = []
    for t in rows:
        wallet = session.get(Wallet, t.id)
        challenges = session.scalar(
            select(func.count()).select_from(Challenge).where(Challenge.trader_id == t.id)
        )
        items.append(
            {
                "id": t.id,
                "email": t.email,
                "displayName": t.display_name,
                "role": t.role,
                "createdAt": t.created_at,
                "walletBalance": float(wallet.available_balance) if wallet else 0.0,
                "challengeCount": int(challenges or 0),
            }
        )
    return page_envelope(items, params=params, total=total, filters=filters)


def list_challenges(
    session: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    q: str | None = None,
    sort_by: str = "createdAt",
    sort_dir: str = "desc",
    status: str | None = None,
) -> dict[str, Any]:
    params = _params(page=page, page_size=page_size, q=q, sort_by=sort_by, sort_dir=sort_dir)
    stmt = select(Challenge).outerjoin(Trader, Trader.id == Challenge.trader_id)
    filters: dict[str, Any] = {}
    if status:
        stmt = stmt.where(Challenge.status == status)
        filters["status"] = status
    if params.q:
        like = f"%{params.q}%"
        stmt = stmt.where(
            or_(
                Challenge.id.ilike(like),
                Challenge.sku.ilike(like),
                Trader.email.ilike(like),
            )
        )
    sort_map = {
        "createdAt": Challenge.created_at,
        "status": Challenge.status,
        "sku": Challenge.sku,
        "accountSize": Challenge.account_size,
        "traderEmail": Trader.email,
    }
    stmt = apply_sort(stmt, sort_map, params, default_key="createdAt")
    rows, total = fetch_page(session, stmt, params)
    items = []
    for c in rows:
        trader = session.get(Trader, c.trader_id)
        acc = session.scalar(select(TradingAccount).where(TradingAccount.challenge_id == c.id))
        items.append(
            {
                "id": c.id,
                "traderId": c.trader_id,
                "traderEmail": trader.email if trader else None,
                "sku": c.sku,
                "accountSize": c.account_size,
                "status": c.status,
                "failReason": c.fail_reason,
                "currentPhase": c.current_phase,
                "equity": float(acc.equity) if acc else float(c.account_size),
                "locked": bool(acc.locked) if acc else False,
                "login": acc.login if acc else None,
                "createdAt": c.created_at,
            }
        )
    return page_envelope(items, params=params, total=total, filters=filters)


def close_challenge(session: Session, challenge_id: str) -> dict[str, Any]:
    c = session.get(Challenge, challenge_id)
    if not c:
        raise DomainError("not found")
    if c.status in {"Closed", "Failed"}:
        raise DomainError("challenge already closed or failed")
    c.status = "Closed"
    acc = session.scalar(select(TradingAccount).where(TradingAccount.challenge_id == c.id))
    if acc:
        acc.locked = True
    audit(
        session,
        "AdminClosedChallenge",
        "admin",
        f"Admin closed challenge {c.id}",
        {"challengeId": c.id, "traderId": c.trader_id},
    )
    trader = session.get(Trader, c.trader_id)
    if trader:
        notify(
            session,
            trader.email,
            "Challenge closed by admin",
            f"Your challenge {c.id} ({c.sku}) was closed by an administrator.",
        )
    return {"id": c.id, "status": c.status, "locked": True}


def _latest_connection(session: Session, trader_id: str) -> ConnectionSnapshot | None:
    row = session.scalar(
        select(LoginHistory)
        .where(LoginHistory.trader_id == trader_id)
        .order_by(LoginHistory.created_at.desc())
        .limit(1)
    )
    if not row:
        return None
    return ConnectionSnapshot(
        ip=row.ip,
        is_vpn=bool(row.is_vpn),
        is_vps=bool(row.is_vps),
        connection_kind=row.connection_kind,
        connection_label=row.connection_label,
    )


def _payout_dto(session: Session, r: PayoutRequest) -> dict[str, Any]:
    trader = session.get(Trader, r.trader_id)
    snap = _latest_connection(session, r.trader_id)
    risk = assess_ip_risk(snap)
    ok, block_reason = can_approve_payout(
        status=r.status,
        risk=risk,
        vps_invoice_status=r.vps_invoice_status,
    )
    return {
        "id": r.id,
        "traderId": r.trader_id,
        "traderEmail": trader.email if trader else None,
        "amount": r.amount,
        "status": r.status,
        "challengeId": r.challenge_id,
        "method": r.method,
        "rewardType": r.reward_type,
        "cryptoNetwork": r.crypto_network,
        "cryptoAddress": r.crypto_address,
        "vpsInvoiceStatus": r.vps_invoice_status,
        "ipRiskNote": r.ip_risk_note or risk.summary,
        "ipRisk": {
            "hasViolation": risk.has_violation,
            "code": risk.code,
            "summary": risk.summary,
            "requiresVpsInvoice": risk.requires_vps_invoice,
            "lastIp": snap.ip if snap else None,
            "isVpn": snap.is_vpn if snap else False,
            "isVps": snap.is_vps if snap else False,
            "connectionLabel": snap.connection_label if snap else None,
        },
        "canApprove": ok,
        "approveBlockedReason": None if ok else block_reason,
        "createdAt": r.created_at,
        "decidedAt": r.decided_at,
    }


def list_payouts(
    session: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    q: str | None = None,
    sort_by: str = "createdAt",
    sort_dir: str = "desc",
    status: str | None = None,
    vps_invoice_status: str | None = None,
) -> dict[str, Any]:
    params = _params(page=page, page_size=page_size, q=q, sort_by=sort_by, sort_dir=sort_dir)
    stmt = select(PayoutRequest).outerjoin(Trader, Trader.id == PayoutRequest.trader_id)
    filters: dict[str, Any] = {}
    if status:
        stmt = stmt.where(PayoutRequest.status == status)
        filters["status"] = status
    if vps_invoice_status:
        stmt = stmt.where(PayoutRequest.vps_invoice_status == vps_invoice_status)
        filters["vpsInvoiceStatus"] = vps_invoice_status
    if params.q:
        like = f"%{params.q}%"
        stmt = stmt.where(
            or_(
                PayoutRequest.id.ilike(like),
                PayoutRequest.crypto_address.ilike(like),
                Trader.email.ilike(like),
            )
        )
    sort_map = {
        "createdAt": PayoutRequest.created_at,
        "amount": PayoutRequest.amount,
        "status": PayoutRequest.status,
        "traderEmail": Trader.email,
    }
    stmt = apply_sort(stmt, sort_map, params, default_key="createdAt")
    rows, total = fetch_page(session, stmt, params)
    items = [_payout_dto(session, r) for r in rows]
    return page_envelope(items, params=params, total=total, filters=filters)


def comment_on_payout(
    session: Session,
    payout_id: str,
    *,
    subject: str,
    message: str,
) -> dict[str, Any]:
    row = session.get(PayoutRequest, payout_id)
    if not row:
        raise DomainError("not found")
    msg = (message or "").strip()
    if not msg:
        raise DomainError("message is required")
    if len(msg) > 4000:
        raise DomainError("message too long")
    trader = session.get(Trader, row.trader_id)
    if not trader:
        raise DomainError("trader not found")
    subj, body = email_templates.payout_admin_comment(
        display_name=trader.display_name,
        payout_id=row.id,
        amount=float(row.amount),
        status=row.status,
        subject=subject,
        message=msg,
    )
    notify(session, trader.email, subj, body)
    audit(
        session,
        "PayoutAdminComment",
        "admin",
        f"Admin emailed trader about payout {row.id}",
        {"payoutId": row.id, "traderId": row.trader_id, "subject": subj},
    )
    return {"ok": True, "toEmail": trader.email, "subject": subj}


def request_vps_invoice(session: Session, payout_id: str) -> dict[str, Any]:
    row = session.get(PayoutRequest, payout_id)
    if not row:
        raise DomainError("not found")
    if row.status not in {"Pending", "NeedsVpsInvoice"}:
        raise DomainError("payout is not pending")
    snap = _latest_connection(session, row.trader_id)
    risk = assess_ip_risk(snap)
    if not risk.requires_vps_invoice:
        raise DomainError("no IP violation requiring a VPS invoice")
    row.status = "NeedsVpsInvoice"
    row.vps_invoice_status = "Requested"
    row.ip_risk_note = risk.summary
    trader = session.get(Trader, row.trader_id)
    if trader:
        subject, body = email_templates.vps_invoice_request(
            display_name=trader.display_name,
            payout_id=row.id,
            amount=float(row.amount),
            risk_summary=risk.summary,
            last_ip=snap.ip if snap else None,
        )
        notify(session, trader.email, subject, body)
    audit(
        session,
        "VpsInvoiceRequested",
        "admin",
        f"Requested VPS invoice for payout {row.id}",
        {"payoutId": row.id, "traderId": row.trader_id},
    )
    return _payout_dto(session, row)


def mark_vps_invoice_received(session: Session, payout_id: str) -> dict[str, Any]:
    row = session.get(PayoutRequest, payout_id)
    if not row:
        raise DomainError("not found")
    if row.status not in {"Pending", "NeedsVpsInvoice"}:
        raise DomainError("payout is not awaiting documentation")
    row.vps_invoice_status = "Received"
    if row.status == "NeedsVpsInvoice":
        row.status = "Pending"
    audit(
        session,
        "VpsInvoiceReceived",
        "admin",
        f"VPS invoice received for payout {row.id}",
        {"payoutId": row.id},
    )
    trader = session.get(Trader, row.trader_id)
    if trader:
        notify(
            session,
            trader.email,
            "VPS invoice received",
            "We received your VPS invoice. An admin can now approve your payout.",
        )
    return _payout_dto(session, row)


def decide_payout(session: Session, payout_id: str, approve: bool) -> dict[str, Any]:
    row = session.get(PayoutRequest, payout_id)
    if not row:
        raise DomainError("not found")
    if row.status not in {"Pending", "NeedsVpsInvoice"}:
        raise DomainError("already decided")
    now = datetime.now(timezone.utc)
    snap = _latest_connection(session, row.trader_id)
    risk = assess_ip_risk(snap)
    if approve:
        allowed, reason = can_approve_payout(
            status=row.status,
            risk=risk,
            vps_invoice_status=row.vps_invoice_status,
        )
        if not allowed:
            raise DomainError(reason)
        w = session.get(Wallet, row.trader_id)
        bal = float(w.available_balance) if w else 0.0
        if row.amount > bal:
            raise DomainError("insufficient balance")
        if w:
            w.available_balance = bal - float(row.amount)
            w.updated_at = now
        row.status = "Approved"
        row.ip_risk_note = risk.summary
        trader = session.get(Trader, row.trader_id)
        if trader:
            subject, body = email_templates.payout_approved_reward_sent(
                display_name=trader.display_name,
                amount=float(row.amount),
                method=row.method or "crypto",
                crypto_network=row.crypto_network,
                crypto_address=row.crypto_address,
                payout_id=row.id,
                wallet_balance_after=float(w.available_balance) if w else 0.0,
            )
            notify(session, trader.email, subject, body)
        audit(
            session,
            "PayoutApproved",
            "admin",
            f"Approved payout {row.id}; reward sent to trader wallet destination",
            {
                "payoutId": row.id,
                "amount": row.amount,
                "cryptoAddress": row.crypto_address,
                "network": row.crypto_network,
            },
        )
    else:
        row.status = "Rejected"
        trader = session.get(Trader, row.trader_id)
        if trader:
            notify(
                session,
                trader.email,
                "Payout rejected",
                "Your payout request was rejected."
                + (f" Note: {risk.summary}" if risk.has_violation else ""),
            )
        audit(
            session,
            "PayoutRejected",
            "admin",
            f"Rejected payout {row.id}",
            {"payoutId": row.id, "amount": row.amount, "ipRisk": risk.code},
        )
    row.decided_at = now
    return _payout_dto(session, row)


def list_products(
    session: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    q: str | None = None,
    sort_by: str = "accountSize",
    sort_dir: str = "asc",
    is_active: bool | None = None,
) -> dict[str, Any]:
    params = _params(
        page=page,
        page_size=page_size,
        q=q,
        sort_by=sort_by,
        sort_dir=sort_dir,
        default_sort="accountSize",
    )
    stmt = select(Product)
    filters: dict[str, Any] = {}
    if is_active is not None:
        stmt = stmt.where(Product.is_active.is_(bool(is_active)))
        filters["isActive"] = bool(is_active)
    if params.q:
        like = f"%{params.q}%"
        stmt = stmt.where(or_(Product.sku.ilike(like), Product.name.ilike(like)))
    sort_map = {
        "accountSize": Product.account_size,
        "price": Product.price,
        "sku": Product.sku,
        "name": Product.name,
        "profitSplitPct": Product.profit_split_pct,
        "isActive": Product.is_active,
    }
    stmt = apply_sort(stmt, sort_map, params, default_key="accountSize")
    rows, total = fetch_page(session, stmt, params)
    items = [
        {
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "accountSize": p.account_size,
            "price": p.price,
            "phaseFamily": p.phase_family,
            "variant": p.variant,
            "profitSplitPct": p.profit_split_pct,
            "isActive": p.is_active,
            "isMostPopular": p.is_most_popular,
        }
        for p in rows
    ]
    return page_envelope(items, params=params, total=total, filters=filters)


def set_product_active(session: Session, product_id: str, active: bool) -> dict[str, Any]:
    p = session.get(Product, product_id)
    if not p:
        raise DomainError("not found")
    p.is_active = bool(active)
    invalidate_catalog()
    audit(
        session,
        "CatalogProductToggled",
        "admin",
        f"Product {p.sku} active={p.is_active}",
        {"productId": p.id, "isActive": p.is_active},
    )
    return {"id": p.id, "sku": p.sku, "isActive": p.is_active}


def list_audit(
    session: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    q: str | None = None,
    sort_by: str = "occurredAt",
    sort_dir: str = "desc",
    event_type: str | None = None,
) -> dict[str, Any]:
    params = _params(
        page=page,
        page_size=page_size,
        q=q,
        sort_by=sort_by,
        sort_dir=sort_dir,
        default_sort="occurredAt",
    )
    stmt = select(AuditEntry)
    filters: dict[str, Any] = {}
    if event_type:
        stmt = stmt.where(AuditEntry.event_type == event_type)
        filters["eventType"] = event_type
    if params.q:
        like = f"%{params.q}%"
        stmt = stmt.where(
            or_(
                AuditEntry.summary.ilike(like),
                AuditEntry.event_type.ilike(like),
                AuditEntry.source.ilike(like),
            )
        )
    sort_map = {
        "occurredAt": AuditEntry.occurred_at,
        "eventType": AuditEntry.event_type,
        "source": AuditEntry.source,
    }
    stmt = apply_sort(stmt, sort_map, params, default_key="occurredAt")
    rows, total = fetch_page(session, stmt, params)
    items = [
        {
            "id": r.id,
            "eventType": r.event_type,
            "source": r.source,
            "summary": r.summary,
            "payloadJson": r.payload_json,
            "occurredAt": r.occurred_at,
        }
        for r in rows
    ]
    return page_envelope(items, params=params, total=total, filters=filters)


def list_notifications(
    session: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    q: str | None = None,
    sort_by: str = "createdAt",
    sort_dir: str = "desc",
    status: str | None = None,
) -> dict[str, Any]:
    params = _params(page=page, page_size=page_size, q=q, sort_by=sort_by, sort_dir=sort_dir)
    stmt = select(Notification)
    filters: dict[str, Any] = {}
    if status:
        stmt = stmt.where(Notification.status == status)
        filters["status"] = status
    if params.q:
        like = f"%{params.q}%"
        stmt = stmt.where(
            or_(Notification.to_email.ilike(like), Notification.subject.ilike(like))
        )
    sort_map = {
        "createdAt": Notification.created_at,
        "toEmail": Notification.to_email,
        "subject": Notification.subject,
        "status": Notification.status,
    }
    stmt = apply_sort(stmt, sort_map, params, default_key="createdAt")
    rows, total = fetch_page(session, stmt, params)
    items = [
        {
            "id": r.id,
            "toEmail": r.to_email,
            "subject": r.subject,
            "status": r.status,
            "deliveryDetail": r.delivery_detail,
            "createdAt": r.created_at,
        }
        for r in rows
    ]
    return page_envelope(items, params=params, total=total, filters=filters)
