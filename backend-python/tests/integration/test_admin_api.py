"""Admin API integration + authorization edge cases."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.architecture.db import SessionLocal, init_db
from app.main import create_app
from app.persistence.models import Notification, PayoutRequest
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


def _login(client: TestClient, email: str, password: str) -> None:
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200


@pytest.mark.integration
def test_trader_forbidden_on_admin_overview(client: TestClient):
    _login(client, "trader@propfirm.local", "Trader1!")
    r = client.get("/api/admin/overview")
    assert r.status_code == 403


@pytest.mark.integration
def test_admin_overview_and_lists(client: TestClient):
    _login(client, "admin@propfirm.local", "Admin1!")
    ov = client.get("/api/admin/overview")
    assert ov.status_code == 200
    body = ov.json()
    assert "traders" in body and body["traders"] >= 2
    assert "payoutsPending" in body
    assert "generatedAt" in body

    traders = client.get("/api/admin/traders?page=1&pageSize=1")
    assert traders.status_code == 200
    tbody = traders.json()
    assert "items" in tbody and "total" in tbody
    assert tbody["pageSize"] == 1
    assert len(tbody["items"]) <= 1
    assert tbody["total"] >= 2

    searched = client.get("/api/admin/traders?q=trader@")
    assert searched.status_code == 200
    assert any(t["email"] == "trader@propfirm.local" for t in searched.json()["items"])

    challenges = client.get("/api/admin/challenges")
    assert challenges.status_code == 200
    assert "items" in challenges.json()

    products = client.get("/api/admin/catalog/products")
    assert products.status_code == 200
    assert len(products.json()["items"]) >= 1


@pytest.mark.integration
def test_admin_toggle_product_and_close_challenge_edges(client: TestClient):
    _login(client, "admin@propfirm.local", "Admin1!")
    products = client.get("/api/admin/catalog/products").json()["items"]
    pid = products[0]["id"]
    active = products[0]["isActive"]
    toggled = client.patch(f"/api/admin/catalog/products/{pid}", json={"isActive": not active})
    assert toggled.status_code == 200
    assert toggled.json()["isActive"] is (not active)
    # restore
    client.patch(f"/api/admin/catalog/products/{pid}", json={"isActive": active})

    missing = client.post("/api/admin/challenges/does-not-exist/close")
    assert missing.status_code == 404

    challenges = client.get("/api/admin/challenges").json()["items"]
    active_ch = next((c for c in challenges if c["status"] in {"Active", "Funded"}), None)
    if active_ch:
        closed = client.post(f"/api/admin/challenges/{active_ch['id']}/close")
        assert closed.status_code == 200
        assert closed.json()["status"] == "Closed"
        again = client.post(f"/api/admin/challenges/{active_ch['id']}/close")
        assert again.status_code == 400


@pytest.mark.integration
def test_admin_payout_decide_not_found(client: TestClient):
    _login(client, "admin@propfirm.local", "Admin1!")
    r = client.post("/api/admin/payouts/missing-id/approve")
    assert r.status_code == 404


@pytest.mark.integration
def test_admin_payout_comment_emails_trader(client: TestClient):
    _login(client, "admin@propfirm.local", "Admin1!")
    with SessionLocal() as session:
        row = session.scalar(select(PayoutRequest).limit(1))
        if not row:
            pytest.skip("no payout rows seeded")
        payout_id = row.id

    r = client.post(
        f"/api/admin/payouts/{payout_id}/comment",
        json={"subject": "Need clarification", "message": "Please confirm your wallet network."},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert "subject" in body

    with SessionLocal() as session:
        note = session.scalar(
            select(Notification)
            .where(Notification.subject == "Need clarification")
            .order_by(Notification.created_at.desc())
        )
        assert note is not None
        assert "Please confirm your wallet network" in note.body
