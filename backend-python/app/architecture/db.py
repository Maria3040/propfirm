from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


_settings = get_settings()
engine = create_engine(_settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)

SCHEMAS = (
    "users",
    "catalog",
    "commerce",
    "challenges",
    "trading",
    "risk",
    "payouts",
    "notifications",
    "audithub",
    "competitions",
)


def ensure_schemas() -> None:
    with engine.begin() as conn:
        for schema in SCHEMAS:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))


def ensure_schemas() -> None:
    with engine.begin() as conn:
        for schema in SCHEMAS:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))


def _ensure_payout_compliance_columns() -> None:
    """Additive columns for existing DBs created before VPS/IP compliance fields."""
    stmts = (
        'ALTER TABLE payouts.payout_requests ADD COLUMN IF NOT EXISTS vps_invoice_status VARCHAR(64)',
        'ALTER TABLE payouts.payout_requests ADD COLUMN IF NOT EXISTS ip_risk_note TEXT',
    )
    with engine.begin() as conn:
        for stmt in stmts:
            try:
                conn.execute(text(stmt))
            except Exception:  # noqa: BLE001
                pass


def init_db() -> None:
    ensure_schemas()
    from app.persistence import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_payout_compliance_columns()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
