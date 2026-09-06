from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.architecture.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Trader(Base):
    __tablename__ = "traders"
    __table_args__ = {"schema": "users"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(64), nullable=False, default="Trader")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class LoginHistory(Base):
    __tablename__ = "login_history"
    __table_args__ = {"schema": "users"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    trader_id: Mapped[str] = mapped_column(String(64), nullable=False)
    ip: Mapped[str | None] = mapped_column(String(64))
    country: Mapped[str | None] = mapped_column(String(120))
    country_code: Mapped[str | None] = mapped_column(String(8))
    city: Mapped[str | None] = mapped_column(String(120))
    isp: Mapped[str | None] = mapped_column(String(200))
    org: Mapped[str | None] = mapped_column(String(200))
    connection_kind: Mapped[str | None] = mapped_column(String(32))
    connection_label: Mapped[str | None] = mapped_column(String(120))
    is_vpn: Mapped[bool] = mapped_column(Boolean, default=False)
    is_vps: Mapped[bool] = mapped_column(Boolean, default=False)
    user_agent: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Product(Base):
    __tablename__ = "challenge_products"
    __table_args__ = {"schema": "catalog"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    sku: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    phase_family: Mapped[str] = mapped_column(String(32), default="two_step")
    variant: Mapped[str] = mapped_column(String(32), default="flex")
    variant_tagline: Mapped[str | None] = mapped_column(String(120))
    account_size: Mapped[float] = mapped_column(Float, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    compare_price: Mapped[float | None] = mapped_column(Float)
    phases: Mapped[int] = mapped_column(Integer, nullable=False)
    profit_target_pct: Mapped[float] = mapped_column(Float, nullable=False)
    phase1_target_pct: Mapped[float] = mapped_column(Float, default=0)
    phase2_target_pct: Mapped[float] = mapped_column(Float, default=0)
    daily_loss_pct: Mapped[float] = mapped_column(Float, nullable=False)
    max_loss_pct: Mapped[float] = mapped_column(Float, nullable=False)
    min_trading_days: Mapped[int] = mapped_column(Integer, nullable=False)
    profit_split_pct: Mapped[float] = mapped_column(Float, default=85)
    reward_cycle: Mapped[str] = mapped_column(String(64), default="Bi-Weekly")
    avg_first_reward: Mapped[float] = mapped_column(Float, default=0)
    is_most_popular: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = {"schema": "commerce"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    trader_id: Mapped[str] = mapped_column(String(64), nullable=False)
    product_id: Mapped[str] = mapped_column(String(64), nullable=False)
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    account_size: Mapped[float] = mapped_column(Float, nullable=False)
    phases: Mapped[int] = mapped_column(Integer, nullable=False)
    profit_target_pct: Mapped[float] = mapped_column(Float, nullable=False)
    phase1_target_pct: Mapped[float] = mapped_column(Float, default=0)
    phase2_target_pct: Mapped[float] = mapped_column(Float, default=0)
    daily_loss_pct: Mapped[float] = mapped_column(Float, nullable=False)
    max_loss_pct: Mapped[float] = mapped_column(Float, nullable=False)
    min_trading_days: Mapped[int] = mapped_column(Integer, nullable=False)
    addon_swap_free: Mapped[bool] = mapped_column(Boolean, default=False)
    platform: Mapped[str] = mapped_column(String(32), default="mt5")
    status: Mapped[str] = mapped_column(String(64), nullable=False)
    payment_intent_id: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PaymentIntent(Base):
    __tablename__ = "payment_intents"
    __table_args__ = {"schema": "commerce"}

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Challenge(Base):
    __tablename__ = "challenge_instances"
    __table_args__ = {"schema": "challenges"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    trader_id: Mapped[str] = mapped_column(String(64), nullable=False)
    order_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    product_id: Mapped[str] = mapped_column(String(64), nullable=False)
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    account_size: Mapped[float] = mapped_column(Float, nullable=False)
    phases: Mapped[int] = mapped_column(Integer, nullable=False)
    current_phase: Mapped[int] = mapped_column(Integer, nullable=False)
    profit_target_pct: Mapped[float] = mapped_column(Float, nullable=False)
    phase1_target_pct: Mapped[float] = mapped_column(Float, default=0)
    phase2_target_pct: Mapped[float] = mapped_column(Float, default=0)
    daily_loss_pct: Mapped[float] = mapped_column(Float, nullable=False)
    max_loss_pct: Mapped[float] = mapped_column(Float, nullable=False)
    min_trading_days: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(64), nullable=False)
    fail_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class TradingAccount(Base):
    __tablename__ = "trading_accounts"
    __table_args__ = {"schema": "trading"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    challenge_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    trader_id: Mapped[str] = mapped_column(String(64), nullable=False)
    login: Mapped[str] = mapped_column(String(64), nullable=False)
    password: Mapped[str] = mapped_column(String(128), nullable=False)
    platform: Mapped[str] = mapped_column(String(32), nullable=False)
    server: Mapped[str] = mapped_column(String(128), nullable=False)
    starting_balance: Mapped[float] = mapped_column(Float, nullable=False)
    equity: Mapped[float] = mapped_column(Float, nullable=False)
    high_water_mark: Mapped[float] = mapped_column(Float, nullable=False)
    locked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Trade(Base):
    __tablename__ = "trades"
    __table_args__ = {"schema": "trading"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    account_id: Mapped[str] = mapped_column(String(64), nullable=False)
    challenge_id: Mapped[str] = mapped_column(String(64), nullable=False)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    side: Mapped[str] = mapped_column(String(16), nullable=False)
    lots: Mapped[float] = mapped_column(Float, nullable=False)
    pnl: Mapped[float] = mapped_column(Float, nullable=False)
    equity_after: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class EquitySnapshot(Base):
    __tablename__ = "equity_snapshots"
    __table_args__ = {"schema": "trading"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    challenge_id: Mapped[str] = mapped_column(String(64), nullable=False)
    equity: Mapped[float] = mapped_column(Float, nullable=False)
    day_pnl: Mapped[float] = mapped_column(Float, nullable=False)
    trading_days: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class BreachRecord(Base):
    __tablename__ = "breach_records"
    __table_args__ = {"schema": "risk"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    challenge_id: Mapped[str] = mapped_column(String(64), nullable=False)
    rule: Mapped[str] = mapped_column(String(64), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Wallet(Base):
    __tablename__ = "trader_wallets"
    __table_args__ = {"schema": "payouts"}

    trader_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    available_balance: Mapped[float] = mapped_column(Float, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class PayoutRequest(Base):
    __tablename__ = "payout_requests"
    __table_args__ = {"schema": "payouts"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    trader_id: Mapped[str] = mapped_column(String(64), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(64), nullable=False)
    challenge_id: Mapped[str | None] = mapped_column(String(64))
    method: Mapped[str | None] = mapped_column(String(64))
    reward_type: Mapped[str | None] = mapped_column(String(64))
    crypto_network: Mapped[str | None] = mapped_column(String(64))
    crypto_address: Mapped[str | None] = mapped_column(String(256))
    vps_invoice_status: Mapped[str | None] = mapped_column(String(64))  # None | Requested | Received
    ip_risk_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Notification(Base):
    __tablename__ = "notification_messages"
    __table_args__ = {"schema": "notifications"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    to_email: Mapped[str] = mapped_column(String(200), nullable=False)
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    delivery_detail: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class AuditEntry(Base):
    __tablename__ = "audit_entries"
    __table_args__ = {"schema": "audithub"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    event_type: Mapped[str] = mapped_column(String(120), nullable=False)
    source: Mapped[str] = mapped_column(String(120), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    payload_json: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class CompetitionJoin(Base):
    __tablename__ = "competition_joins"
    __table_args__ = (
        UniqueConstraint("trader_id", "competition_id", name="uq_comp_join"),
        {"schema": "competitions"},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    trader_id: Mapped[str] = mapped_column(String(64), nullable=False)
    competition_id: Mapped[str] = mapped_column(String(64), nullable=False)
    competition_title: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
