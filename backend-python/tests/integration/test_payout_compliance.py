"""Payout IP compliance + approve email/wallet debit."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.architecture.db import SessionLocal, init_db
from app.main import create_app
from app.persistence.models import Notification, PayoutRequest, Trader, Wallet
from app.seed import seed


@pytest.fixture(scope="module")
def client():
    try:
        init_db()
        with SessionLocal() as session:
            seed(session)
            session.commit()
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"Postgres not available: {exc}")
    app = create_app()
    with TestClient(app) as c:
        yield c


def _login(client: TestClient, email: str, password: str, headers: dict | None = None) -> None:
    r = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
        headers=headers or {},
    )
    assert r.status_code == 200


@pytest.mark.integration
def test_approve_blocked_until_vps_invoice_then_reward_email(client: TestClient):
    # Trader login with simulated VPN
    _login(
        client,
        "trader@propfirm.local",
        "Trader1!",
        headers={"X-PropFirm-Sim-Connection": "vpn"},
    )
    elig = client.get("/api/payouts/eligible").json()
    acc = next((a for a in elig["accounts"] if a.get("withdrawable", 0) > 0), None)
    if not acc:
        pytest.skip("no withdrawable funded account")
    amount = min(10.0, float(acc["withdrawable"]))
    created = client.post(
        "/api/payouts/request",
        json={
            "amount": amount,
            "challengeId": acc["id"],
            "method": "crypto",
            "cryptoNetwork": "USDT TRC20",
            "cryptoAddress": "TXcomplianceDemoWallet111",
        },
    )
    assert created.status_code == 200, created.text
    payout_id = created.json()["id"]

    # Admin sees IP risk and cannot approve yet
    client.post("/api/auth/logout")
    _login(client, "admin@propfirm.local", "Admin1!")
    listed = client.get("/api/admin/payouts").json()["items"]
    row = next(p for p in listed if p["id"] == payout_id)
    assert row["ipRisk"]["hasViolation"] is True
    assert row["canApprove"] is False

    blocked = client.post(f"/api/admin/payouts/{payout_id}/approve")
    assert blocked.status_code == 400
    assert "VPS invoice" in blocked.text or "IP violation" in blocked.text

    req_inv = client.post(f"/api/admin/payouts/{payout_id}/request-vps-invoice")
    assert req_inv.status_code == 200
    assert req_inv.json()["vpsInvoiceStatus"] == "Requested"
    assert req_inv.json()["status"] == "NeedsVpsInvoice"

    marked = client.post(f"/api/admin/payouts/{payout_id}/vps-invoice-received")
    assert marked.status_code == 200
    assert marked.json()["vpsInvoiceStatus"] == "Received"
    assert marked.json()["canApprove"] is True

    with SessionLocal() as session:
        trader = session.scalar(select(Trader).where(Trader.email == "trader@propfirm.local"))
        assert trader
        before = float(session.get(Wallet, trader.id).available_balance)

    approved = client.post(f"/api/admin/payouts/{payout_id}/approve")
    assert approved.status_code == 200
    assert approved.json()["status"] == "Approved"

    with SessionLocal() as session:
        trader = session.scalar(select(Trader).where(Trader.email == "trader@propfirm.local"))
        after = float(session.get(Wallet, trader.id).available_balance)
        assert after == pytest.approx(before - amount, rel=1e-6)
        mail = session.scalars(
            select(Notification)
            .where(Notification.to_email == "trader@propfirm.local")
            .order_by(Notification.created_at.desc())
            .limit(5)
        ).all()
        subjects = [m.subject for m in mail]
        assert any("VPS invoice" in s for s in subjects)
        assert any("Payout approved" in s and "sent to your wallet" in s for s in subjects)
        payout = session.get(PayoutRequest, payout_id)
        assert payout and payout.status == "Approved"
