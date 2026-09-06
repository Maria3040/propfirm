from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import func, select

from app.architecture import cache, rate_limit
from app.architecture.security import hash_password, issue_token, revoke_token, verify_password
from app.api.deps import DbSession, User
from app.config import get_settings
from app.modules.commerce.domain.pricing import apply_coupon, lookup_coupon, price_order
from app.modules.payouts.domain.profit_share import profit_share_cap, remaining_withdrawable
from app.persistence.models import (
    AuditEntry,
    Challenge,
    CompetitionJoin,
    EquitySnapshot,
    LoginHistory,
    Notification,
    Order,
    PaymentIntent,
    PayoutRequest,
    Product,
    Trader,
    TradingAccount,
    Wallet,
)
from app.services import notify, on_order_paid, simulate_trade
from app.shared_kernel.errors import DomainError

router = APIRouter()


def _nest_error(status: int, message: str) -> JSONResponse:
    # Match Nest HttpException body (JSON string).
    return JSONResponse(status_code=status, content=message)


def _product_dto(p: Product) -> dict[str, Any]:
    return {
        "id": p.id,
        "sku": p.sku,
        "name": p.name,
        "description": p.description,
        "phaseFamily": p.phase_family,
        "variant": p.variant,
        "variantTagline": p.variant_tagline,
        "accountSize": p.account_size,
        "price": p.price,
        "comparePrice": p.compare_price,
        "phases": p.phases,
        "profitTargetPct": p.profit_target_pct,
        "phase1TargetPct": p.phase1_target_pct,
        "phase2TargetPct": p.phase2_target_pct,
        "dailyLossPct": p.daily_loss_pct,
        "maxLossPct": p.max_loss_pct,
        "minTradingDays": p.min_trading_days,
        "profitSplitPct": p.profit_split_pct,
        "rewardCycle": p.reward_cycle,
        "avgFirstReward": p.avg_first_reward,
        "isMostPopular": p.is_most_popular,
    }


def _set_auth_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.production,
        max_age=8 * 60 * 60,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(settings.auth_cookie_name, path="/")


class AuthBody(BaseModel):
    email: str
    password: str
    displayName: str | None = None
    clientIp: str | None = None


class CouponBody(BaseModel):
    code: str
    subtotal: float


class OrderBody(BaseModel):
    productId: str
    addonSwapFree: bool = False
    platform: str = "mt5"
    quantity: int = 1
    couponCode: str | None = None


class SimulateBody(BaseModel):
    symbol: str | None = "EURUSD"
    side: str | None = "buy"
    lots: float = 1
    pnl: float
    # Optional ISO date (YYYY-MM-DD) to backdate the trade for multi-day risk demos.
    tradeDay: str | None = None


class PayoutBody(BaseModel):
    amount: float
    challengeId: str | None = None
    method: str | None = "crypto"
    cryptoNetwork: str | None = None
    cryptoAddress: str | None = None


class JoinBody(BaseModel):
    title: str | None = None


@router.get("/")
def root() -> dict[str, str]:
    return {
        "service": "PropFirm modular API (Python FastAPI + SQLAlchemy + Redis)",
        "orm": "SQLAlchemy",
        "docs": "/docs",
        "metrics": "/metrics",
    }


@router.get("/metrics")
def metrics() -> PlainTextResponse:
    return PlainTextResponse("# propfirm_python 1\n")


@router.post("/api/auth/register")
def register(body: AuthBody, request: Request, response: Response, db: DbSession):
    email = body.email.strip()
    if not email or not body.password:
        return _nest_error(400, "email and password required")
    exists = db.scalar(select(Trader).where(func.lower(Trader.email) == email.lower()))
    if exists:
        return _nest_error(400, "email already registered")
    trader = Trader(
        email=email,
        password_hash=hash_password(body.password),
        display_name=body.displayName or email,
        role="Trader",
    )
    db.add(trader)
    db.flush()
    _record_login(db, trader.id, request, body.clientIp)
    token = issue_token(trader.id, trader.email, trader.role, trader.display_name)
    _set_auth_cookie(response, token)
    return {
        "userId": trader.id,
        "email": trader.email,
        "displayName": trader.display_name,
        "role": trader.role,
    }


@router.post("/api/auth/login")
def login(body: AuthBody, request: Request, response: Response, db: DbSession):
    ip = body.clientIp or (request.client.host if request.client else "unknown")
    if not rate_limit.allow_login_attempt(ip or "unknown"):
        return _nest_error(429, "too many login attempts")
    email = body.email.strip()
    trader = db.scalar(select(Trader).where(func.lower(Trader.email) == email.lower()))
    if not trader or not verify_password(body.password, trader.password_hash):
        return _nest_error(401, "unauthorized")
    _record_login(db, trader.id, request, body.clientIp)
    token = issue_token(trader.id, trader.email, trader.role, trader.display_name)
    _set_auth_cookie(response, token)
    return {
        "userId": trader.id,
        "email": trader.email,
        "displayName": trader.display_name,
        "role": trader.role,
    }


@router.post("/api/auth/logout")
def logout(request: Request, response: Response):
    settings = get_settings()
    token = request.cookies.get(settings.auth_cookie_name)
    if token:
        revoke_token(token)
    _clear_auth_cookie(response)
    return {"ok": True}


@router.get("/api/users/me")
def me(user: User, db: DbSession):
    trader = db.get(Trader, user["sub"])
    if not trader:
        return _nest_error(404, "not found")
    return {
        "id": trader.id,
        "email": trader.email,
        "displayName": trader.display_name,
        "role": trader.role,
    }


@router.get("/api/users/me/login-history")
def login_history(user: User, db: DbSession):
    rows = db.scalars(
        select(LoginHistory)
        .where(LoginHistory.trader_id == user["sub"])
        .order_by(LoginHistory.created_at.desc())
        .limit(50)
    ).all()
    return [
        {
            "id": r.id,
            "ip": r.ip,
            "country": r.country,
            "countryCode": r.country_code,
            "city": r.city,
            "isp": r.isp,
            "org": r.org,
            "connectionKind": r.connection_kind,
            "connectionLabel": r.connection_label,
            "isVpn": r.is_vpn,
            "isVps": r.is_vps,
            "userAgent": r.user_agent,
            "createdAt": r.created_at,
        }
        for r in rows
    ]


def _record_login(db: DbSession, trader_id: str, request: Request, client_ip: str | None) -> None:
    ip = client_ip or (request.client.host if request.client else None)
    ua = (request.headers.get("user-agent") or "")[:500] or None
    # Demo heuristics / explicit simulation headers for compliance tests.
    sim = (request.headers.get("x-propfirm-sim-connection") or "").lower()
    is_vpn = sim == "vpn" or (ip or "").startswith("10.99.")
    is_vps = sim == "vps"
    if is_vpn and not is_vps:
        kind, label = "vpn", "VPN / proxy (demo)"
    elif is_vps:
        kind, label = "vps", "Approved VPS (demo)"
    elif sim == "datacenter":
        kind, label = "datacenter", "Datacenter / hosting (demo)"
        is_vpn = False
    else:
        kind, label = "residential", "Residential / local"
    db.add(
        LoginHistory(
            trader_id=trader_id,
            ip=ip or ("10.99.1.1" if is_vpn else "127.0.0.1"),
            connection_kind=kind,
            connection_label=label,
            is_vpn=is_vpn,
            is_vps=is_vps,
            user_agent=ua,
        )
    )


@router.get("/api/catalog/products")
def list_products(db: DbSession, phaseFamily: str | None = None, variant: str | None = None):
    key = cache.catalog_key(phaseFamily, variant)
    cached = cache.get_json(key)
    if cached is not None:
        return cached
    q = select(Product).where(Product.is_active.is_(True)).order_by(Product.account_size.asc())
    if phaseFamily:
        q = q.where(Product.phase_family == phaseFamily)
    if variant:
        q = q.where(Product.variant == variant)
    rows = [_product_dto(p) for p in db.scalars(q).all()]
    cache.set_json(key, rows)
    return rows


@router.get("/api/catalog/products/{product_id}")
def get_product(product_id: str, db: DbSession):
    p = db.get(Product, product_id)
    if not p:
        return _nest_error(404, "not found")
    return _product_dto(p)


@router.post("/api/coupons/validate")
def validate_coupon(body: CouponBody):
    coupon = lookup_coupon(body.code)
    if not coupon:
        return _nest_error(400, "invalid coupon")
    try:
        quote = apply_coupon(coupon, body.subtotal)
    except DomainError as exc:
        return _nest_error(400, exc.message)
    return {
        "valid": True,
        "code": quote.code,
        "kind": quote.kind,
        "value": quote.value,
        "discountAmount": quote.discount_amount,
        "finalTotal": quote.final_total,
        "message": quote.message,
    }


@router.post("/api/orders")
def create_order(body: OrderBody, user: User, db: DbSession):
    product = db.scalar(select(Product).where(Product.id == body.productId, Product.is_active.is_(True)))
    if not product:
        return _nest_error(404, "product not found")
    price, platform = price_order(product.price, body.addonSwapFree, body.platform, body.quantity)
    coupon_applied = None
    if body.couponCode:
        coupon = lookup_coupon(body.couponCode)
        if not coupon:
            return _nest_error(400, "invalid coupon")
        try:
            quote = apply_coupon(coupon, price)
        except DomainError as exc:
            return _nest_error(400, exc.message)
        price = quote.final_total
        coupon_applied = {
            "code": quote.code,
            "kind": quote.kind,
            "value": quote.value,
            "discountAmount": quote.discount_amount,
            "finalTotal": quote.final_total,
            "message": quote.message,
        }
    intent_id = f"pi_{uuid.uuid4()}"
    db.add(PaymentIntent(id=intent_id, amount=price, status="requires_confirmation"))
    p1 = product.phase1_target_pct or product.profit_target_pct
    order = Order(
        trader_id=user["sub"],
        product_id=product.id,
        sku=product.sku,
        price=price,
        account_size=product.account_size,
        phases=product.phases,
        profit_target_pct=p1,
        phase1_target_pct=p1,
        phase2_target_pct=product.phase2_target_pct or 0,
        daily_loss_pct=product.daily_loss_pct,
        max_loss_pct=product.max_loss_pct,
        min_trading_days=product.min_trading_days,
        addon_swap_free=body.addonSwapFree,
        platform=platform,
        status="RequiresConfirmation",
        payment_intent_id=intent_id,
    )
    db.add(order)
    db.flush()
    return {
        "orderId": order.id,
        "status": order.status,
        "price": order.price,
        "addonSwapFree": body.addonSwapFree,
        "platform": platform,
        "paymentIntentId": intent_id,
        "coupon": coupon_applied,
        "nextPath": f"/checkout/confirm/{order.id}",
    }


@router.post("/api/orders/{order_id}/confirm")
def confirm_order(order_id: str, user: User, db: DbSession):
    order = db.get(Order, order_id)
    if not order or order.trader_id != user["sub"]:
        return _nest_error(404, "not found")
    if order.status == "Paid":
        ch = db.scalar(select(Challenge).where(Challenge.order_id == order_id))
        return {"orderId": order_id, "status": "Paid", "challengeId": ch.id if ch else None, "alreadyPaid": True}
    if not order.payment_intent_id:
        return _nest_error(400, "missing payment intent")
    intent = db.get(PaymentIntent, order.payment_intent_id)
    if not intent:
        return _nest_error(400, "payment intent not found")
    if intent.status == "requires_confirmation":
        intent.status = "succeeded"
        intent.confirmed_at = datetime.now(timezone.utc)
    order.status = "Paid"
    order.paid_at = datetime.now(timezone.utc)
    db.flush()
    challenge = on_order_paid(db, order)
    return {
        "orderId": order_id,
        "status": "Paid",
        "challengeId": challenge.id,
        "nextPath": f"/challenges/{challenge.id}",
    }


@router.get("/api/challenges")
def list_challenges(user: User, db: DbSession):
    q = select(Challenge).order_by(Challenge.created_at.desc())
    if user["role"] != "Admin":
        q = q.where(Challenge.trader_id == user["sub"])
    rows = db.scalars(q).all()
    out = []
    for c in rows:
        acc = db.scalar(select(TradingAccount).where(TradingAccount.challenge_id == c.id))
        equity = acc.equity if acc else c.account_size
        pnl = equity - c.account_size
        out.append(
            {
                "id": c.id,
                "traderId": c.trader_id,
                "orderId": c.order_id,
                "productId": c.product_id,
                "sku": c.sku,
                "accountSize": c.account_size,
                "phases": c.phases,
                "currentPhase": c.current_phase,
                "profitTargetPct": c.profit_target_pct,
                "phase1TargetPct": c.phase1_target_pct,
                "phase2TargetPct": c.phase2_target_pct,
                "dailyLossPct": c.daily_loss_pct,
                "maxLossPct": c.max_loss_pct,
                "minTradingDays": c.min_trading_days,
                "status": c.status,
                "failReason": c.fail_reason,
                "createdAt": c.created_at,
                "equity": equity,
                "pnl": pnl,
                "profitPct": (pnl / c.account_size) * 100 if c.account_size else 0,
                "login": acc.login if acc else None,
                "platform": acc.platform if acc else None,
            }
        )
    return out


@router.get("/api/challenges/{challenge_id}")
def get_challenge(challenge_id: str, user: User, db: DbSession):
    c = db.get(Challenge, challenge_id)
    if not c:
        return _nest_error(404, "not found")
    if user["role"] != "Admin" and c.trader_id != user["sub"]:
        return _nest_error(403, "forbidden")
    acc = db.scalar(select(TradingAccount).where(TradingAccount.challenge_id == c.id))
    history = db.scalars(
        select(EquitySnapshot)
        .where(EquitySnapshot.challenge_id == c.id)
        .order_by(EquitySnapshot.created_at.asc())
        .limit(60)
    ).all()
    equity = acc.equity if acc else c.account_size
    hwm = acc.high_water_mark if acc else equity
    max_equity = max([equity, hwm, c.account_size] + [h.equity for h in history])
    target_pct = c.phase1_target_pct if c.current_phase <= 1 else c.phase2_target_pct
    if not target_pct:
        target_pct = c.profit_target_pct
    snap = history[-1] if history else None
    return {
        "id": c.id,
        "traderId": c.trader_id,
        "orderId": c.order_id,
        "productId": c.product_id,
        "sku": c.sku,
        "accountSize": c.account_size,
        "phases": c.phases,
        "currentPhase": c.current_phase,
        "profitTargetPct": c.profit_target_pct,
        "phase1TargetPct": c.phase1_target_pct,
        "phase2TargetPct": c.phase2_target_pct,
        "dailyLossPct": c.daily_loss_pct,
        "maxLossPct": c.max_loss_pct,
        "minTradingDays": c.min_trading_days,
        "status": c.status,
        "failReason": c.fail_reason,
        "createdAt": c.created_at,
        "account": None
        if not acc
        else {
            "id": acc.id,
            "login": acc.login,
            "password": acc.password,
            "platform": acc.platform,
            "server": acc.server,
            "equity": acc.equity,
            "startingBalance": acc.starting_balance,
            "highWaterMark": acc.high_water_mark,
            "locked": acc.locked,
        },
        "progress": {
            "equity": equity,
            "maxEquity": max_equity,
            "targetEquity": c.account_size * (1 + target_pct / 100),
            "targetPct": target_pct,
            "profitPct": ((equity - c.account_size) / c.account_size) * 100,
            "tradingDays": snap.trading_days if snap else 0,
            "minTradingDays": c.min_trading_days,
            "dayPnl": snap.day_pnl if snap else 0,
        },
        "equitySeries": [{"t": h.created_at, "equity": h.equity, "dayPnl": h.day_pnl} for h in history],
    }


@router.post("/api/challenges/{challenge_id}/archive")
def archive_challenge(challenge_id: str, user: User, db: DbSession):
    c = db.get(Challenge, challenge_id)
    if not c:
        return _nest_error(404, "not found")
    if user["role"] != "Admin" and c.trader_id != user["sub"]:
        return _nest_error(403, "forbidden")
    c.status = "Closed"
    acc = db.scalar(select(TradingAccount).where(TradingAccount.challenge_id == c.id))
    if acc:
        acc.locked = True
    return {"ok": True, "id": c.id, "status": "Closed"}


@router.post("/api/challenges/{challenge_id}/trades/simulate")
def simulate(challenge_id: str, body: SimulateBody, user: User, db: DbSession):
    c = db.get(Challenge, challenge_id)
    if not c:
        return _nest_error(404, "not found")
    if user["role"] != "Admin" and c.trader_id != user["sub"]:
        return _nest_error(403, "forbidden")
    try:
        return simulate_trade(
            db,
            challenge_id,
            body.symbol or "EURUSD",
            body.side or "buy",
            body.lots,
            body.pnl,
            trade_day=body.tradeDay,
        )
    except DomainError as exc:
        return _nest_error(400, exc.message)


@router.get("/api/payouts/wallet")
def wallet(user: User, db: DbSession):
    w = db.get(Wallet, user["sub"])
    return {"traderId": user["sub"], "availableBalance": w.available_balance if w else 0}


@router.get("/api/payouts/eligible")
def eligible(user: User, db: DbSession):
    w = db.get(Wallet, user["sub"])
    bal = float(w.available_balance) if w else 0.0
    funded = db.scalars(
        select(Challenge)
        .where(Challenge.trader_id == user["sub"], Challenge.status == "Funded")
        .order_by(Challenge.created_at.desc())
    ).all()
    accounts = []
    for c in funded:
        acc = db.scalar(select(TradingAccount).where(TradingAccount.challenge_id == c.id))
        equity = float(acc.equity) if acc else float(c.account_size)
        product = db.get(Product, c.product_id)
        split = float(product.profit_split_pct) if product else 80.0
        cap = profit_share_cap(equity, float(c.account_size), split)
        already = db.scalar(
            select(func.coalesce(func.sum(PayoutRequest.amount), 0)).where(
                PayoutRequest.challenge_id == c.id,
                PayoutRequest.status.in_(("Pending", "Approved")),
            )
        )
        already_f = float(already or 0)
        share_available = remaining_withdrawable(cap, already_f)
        # Cannot withdraw more than ledger wallet either.
        withdrawable = round(min(share_available, bal), 2)
        accounts.append(
            {
                "id": c.id,
                "sku": c.sku,
                "status": c.status,
                "accountSize": c.account_size,
                "equity": equity,
                "login": acc.login if acc else None,
                "platform": acc.platform if acc else None,
                "profitSplitPct": split,
                "grossProfit": round(max(0.0, equity - float(c.account_size)), 2),
                "profitShareCap": cap,
                "alreadyRequested": already_f,
                "profitShareAvailable": share_available,
                "withdrawable": withdrawable,
            }
        )
    return {"availableBalance": bal, "accounts": accounts}


@router.post("/api/payouts/request")
def request_payout(body: PayoutBody, user: User, db: DbSession):
    if body.amount <= 0:
        return _nest_error(400, "invalid amount")
    method = (body.method or "crypto").lower()
    if method == "crypto" and (not body.cryptoNetwork or not body.cryptoAddress):
        return _nest_error(400, "cryptoNetwork and cryptoAddress required")
    if not body.challengeId:
        return _nest_error(400, "challengeId required")
    c = db.get(Challenge, body.challengeId)
    if not c or c.trader_id != user["sub"] or c.status != "Funded":
        return _nest_error(400, "invalid challenge")
    acc = db.scalar(select(TradingAccount).where(TradingAccount.challenge_id == c.id))
    equity = float(acc.equity) if acc else float(c.account_size)
    product = db.get(Product, c.product_id)
    split = float(product.profit_split_pct) if product else 80.0
    cap = profit_share_cap(equity, float(c.account_size), split)
    already = db.scalar(
        select(func.coalesce(func.sum(PayoutRequest.amount), 0)).where(
            PayoutRequest.challenge_id == c.id,
            PayoutRequest.status.in_(("Pending", "Approved")),
        )
    )
    share_available = remaining_withdrawable(cap, float(already or 0))
    if body.amount > share_available + 1e-9:
        return _nest_error(
            400,
            f"amount exceeds profit share for this account ({share_available:.2f})",
        )
    w = db.get(Wallet, user["sub"])
    bal = float(w.available_balance) if w else 0.0
    if body.amount > bal:
        return _nest_error(400, "insufficient balance")
    row = PayoutRequest(
        trader_id=user["sub"],
        amount=body.amount,
        status="Pending",
        challenge_id=c.id,
        method=method,
        reward_type="Profit share",
        crypto_network=body.cryptoNetwork,
        crypto_address=body.cryptoAddress,
    )
    db.add(row)
    db.flush()
    return {
        "id": row.id,
        "traderId": row.trader_id,
        "amount": row.amount,
        "status": row.status,
        "challengeId": row.challenge_id,
        "method": row.method,
        "rewardType": row.reward_type,
        "cryptoNetwork": row.crypto_network,
        "cryptoAddress": row.crypto_address,
        "createdAt": row.created_at,
        "decidedAt": row.decided_at,
        "profitShareAvailableAfter": round(share_available - body.amount, 2),
    }


@router.get("/api/payouts")
def list_payouts(user: User, db: DbSession):
    q = select(PayoutRequest).order_by(PayoutRequest.created_at.desc())
    if user["role"] != "Admin":
        q = q.where(PayoutRequest.trader_id == user["sub"])
    rows = db.scalars(q).all()
    return [
        {
            "id": r.id,
            "traderId": r.trader_id,
            "amount": r.amount,
            "status": r.status,
            "challengeId": r.challenge_id,
            "method": r.method,
            "rewardType": r.reward_type,
            "cryptoNetwork": r.crypto_network,
            "cryptoAddress": r.crypto_address,
            "createdAt": r.created_at,
            "decidedAt": r.decided_at,
        }
        for r in rows
    ]


@router.get("/api/competitions/joined")
def joined(user: User, db: DbSession):
    key = cache.joined_key(user["sub"])
    cached = cache.get_json(key)
    if cached is not None:
        return cached
    ids = list(
        db.scalars(select(CompetitionJoin.competition_id).where(CompetitionJoin.trader_id == user["sub"])).all()
    )
    payload = {"competitionIds": ids}
    cache.set_json(key, payload, ttl=30)
    return payload


@router.post("/api/competitions/{competition_id}/join")
def join_competition(competition_id: str, body: JoinBody, user: User, db: DbSession):
    existing = db.scalar(
        select(CompetitionJoin).where(
            CompetitionJoin.trader_id == user["sub"],
            CompetitionJoin.competition_id == competition_id,
        )
    )
    if existing:
        return {"joined": True, "alreadyJoined": True, "emailSent": False}
    db.add(
        CompetitionJoin(
            trader_id=user["sub"],
            competition_id=competition_id,
            competition_title=body.title,
        )
    )
    cache.invalidate_joined(user["sub"])
    trader = db.get(Trader, user["sub"])
    if trader:
        notify(db, trader.email, "Competition joined", f"You joined: {body.title or competition_id}")
    return {"joined": True, "alreadyJoined": False, "emailSent": True}


@router.get("/api/notifications")
def notifications(user: User, db: DbSession):
    trader = db.get(Trader, user["sub"])
    email = trader.email if trader else ""
    rows = db.scalars(
        select(Notification)
        .where(Notification.to_email == email)
        .order_by(Notification.created_at.desc())
        .limit(50)
    ).all()
    return [
        {
            "id": r.id,
            "toEmail": r.to_email,
            "subject": r.subject,
            "body": r.body,
            "status": r.status,
            "deliveryDetail": r.delivery_detail,
            "createdAt": r.created_at,
        }
        for r in rows
    ]
