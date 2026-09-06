"""Integration tests against local Postgres (+ Redis if available)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.architecture.db import SessionLocal, init_db
from app.main import create_app
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


@pytest.mark.integration
def test_root(client: TestClient):
    r = client.get("/")
    assert r.status_code == 200
    assert "Python" in r.json()["service"]


@pytest.mark.integration
def test_login_catalog_coupon_order(client: TestClient):
    login = client.post(
        "/api/auth/login",
        json={"email": "trader@propfirm.local", "password": "Trader1!"},
    )
    assert login.status_code == 200
    assert "propfirm_access" in login.cookies

    products = client.get("/api/catalog/products")
    assert products.status_code == 200
    assert len(products.json()) >= 1
    product_id = products.json()[0]["id"]

    coupon = client.post("/api/coupons/validate", json={"code": "WELCOME10", "subtotal": 100})
    assert coupon.status_code == 200
    assert coupon.json()["finalTotal"] == 90

    order = client.post("/api/orders", json={"productId": product_id})
    assert order.status_code == 200
    order_id = order.json()["orderId"]

    paid = client.post(f"/api/orders/{order_id}/confirm")
    assert paid.status_code == 200
    assert paid.json()["status"] == "Paid"
    assert paid.json()["challengeId"]

    cid = paid.json()["challengeId"]
    sim = client.post(
        f"/api/challenges/{cid}/trades/simulate",
        json={"pnl": 50, "symbol": "EURUSD", "side": "buy", "lots": 1},
    )
    assert sim.status_code == 200
    assert sim.json()["equity"] is not None

    elig = client.get("/api/payouts/eligible")
    assert elig.status_code == 200
    assert "accounts" in elig.json()
    if elig.json()["accounts"]:
        assert "equity" in elig.json()["accounts"][0]


@pytest.mark.integration
def test_logout_denies_cookie(client: TestClient):
    login = client.post(
        "/api/auth/login",
        json={"email": "trader@propfirm.local", "password": "Trader1!"},
    )
    assert login.status_code == 200
    me = client.get("/api/users/me")
    assert me.status_code == 200
    client.post("/api/auth/logout")
    # Without Redis denylist, cookie may still decode; client clears cookie so me should 401.
    me2 = client.get("/api/users/me")
    assert me2.status_code == 401
