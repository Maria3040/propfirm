from __future__ import annotations

import uuid
from datetime import datetime, timezone

from passlib.context import CryptContext
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.architecture.cache import invalidate_catalog
from app.modules.catalog import seed_data
from app.persistence.models import Challenge, LoginHistory, Order, Product, TradingAccount, Trader, Wallet

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def seed(session: Session) -> None:
    count = session.scalar(select(func.count()).select_from(Product)) or 0
    if count < 25:
        for row in seed_data.build_catalog():
            existing = session.scalar(select(Product).where(Product.sku == row["sku"]))
            if existing:
                continue
            session.add(Product(**row))
        session.flush()
        invalidate_catalog()

    _ensure_user(session, "trader@propfirm.local", "Trader1!", "Demo Trader", "Trader")
    _ensure_user(session, "admin@propfirm.local", "Admin1!", "Admin", "Admin")
    _seed_funded_demo(session)


def _ensure_user(session: Session, email: str, password: str, display: str, role: str) -> None:
    trader = session.scalar(select(Trader).where(func.lower(Trader.email) == email.lower()))
    if trader:
        return
    session.add(
        Trader(
            id=str(uuid.uuid4()),
            email=email,
            password_hash=pwd.hash(password),
            display_name=display,
            role=role,
        )
    )


def _seed_funded_demo(session: Session) -> None:
    order_id = "seed-order-funded-demo"
    existing = session.scalar(select(Challenge).where(Challenge.order_id == order_id))
    trader = session.scalar(select(Trader).where(func.lower(Trader.email) == "trader@propfirm.local"))
    if not trader:
        return
    product = session.scalar(
        select(Product).where(
            Product.account_size == 100000,
            Product.phase_family == "two_step",
            Product.variant == "standard",
        )
    )
    product_id = product.id if product else str(uuid.uuid4())
    sku = product.sku if product else "SEED-100K"
    now = datetime.now(timezone.utc)
    if not existing:
        if not session.get(Order, order_id):
            session.add(
                Order(
                    id=order_id,
                    trader_id=trader.id,
                    product_id=product_id,
                    sku=sku,
                    price=0,
                    account_size=100000,
                    phases=2,
                    profit_target_pct=5,
                    phase1_target_pct=8,
                    phase2_target_pct=5,
                    daily_loss_pct=5,
                    max_loss_pct=10,
                    min_trading_days=3,
                    platform="mt5",
                    status="Paid",
                    payment_intent_id="pi_seed",
                    paid_at=now,
                )
            )
        ch_id = str(uuid.uuid4())
        session.add(
            Challenge(
                id=ch_id,
                trader_id=trader.id,
                order_id=order_id,
                product_id=product_id,
                sku=sku,
                account_size=100000,
                phases=2,
                current_phase=3,
                profit_target_pct=5,
                phase1_target_pct=8,
                phase2_target_pct=5,
                daily_loss_pct=5,
                max_loss_pct=10,
                min_trading_days=3,
                status="Funded",
            )
        )
        session.flush()
        acc = session.scalar(select(TradingAccount).where(TradingAccount.challenge_id == ch_id))
        if not acc:
            session.add(
                TradingAccount(
                    challenge_id=ch_id,
                    trader_id=trader.id,
                    login="10001234",
                    password="FundedDemo1!",
                    platform="mt5",
                    server="PropFirm-Demo-MT5",
                    starting_balance=100000,
                    equity=112000,
                    high_water_mark=112000,
                    locked=False,
                )
            )
    wallet = session.get(Wallet, trader.id)
    if not wallet:
        session.add(Wallet(trader_id=trader.id, available_balance=2500))
    elif wallet.available_balance < 100:
        wallet.available_balance = float(wallet.available_balance) + 2500

    # Demo compliance signal: latest login looks like VPN without VPS.
    vpn_hit = session.scalar(
        select(LoginHistory).where(
            LoginHistory.trader_id == trader.id,
            LoginHistory.is_vpn.is_(True),
        )
    )
    if not vpn_hit:
        session.add(
            LoginHistory(
                trader_id=trader.id,
                ip="10.99.8.22",
                connection_kind="vpn",
                connection_label="VPN / proxy (demo)",
                is_vpn=True,
                is_vps=False,
                user_agent="PropFirm-Seed/1.0",
            )
        )
