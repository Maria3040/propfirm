from app.architecture.email_templates import account_breach, purchase_invoice_and_credentials


def test_purchase_email_includes_invoice_and_credentials():
    subject, body = purchase_invoice_and_credentials(
        display_name="Demo Trader",
        order_id="ord-1",
        sku="2STEP-5K",
        price=49.0,
        account_size=5000,
        platform="mt5",
        server="PropFirm-Demo-MT5",
        login="10001234",
        password="Pwd_abc!",
        challenge_id="ch-1",
        paid_at="2026-09-06T12:00:00+00:00",
    )
    assert "Invoice" in subject or "credentials" in subject.lower()
    assert "ord-1" in body and "Amount paid" in body
    assert "10001234" in body and "Pwd_abc!" in body


def test_breach_email_includes_rule_and_reason():
    subject, body = account_breach(
        display_name="Demo Trader",
        challenge_id="ch-9",
        sku="2STEP-5K",
        rule="DailyLoss",
        reason="Daily loss -300.00 exceeded -250.00",
        login="10009999",
        equity=4700.0,
    )
    assert "breached" in subject.lower()
    assert "DailyLoss" in subject and "DailyLoss" in body
    assert "exceeded" in body
    assert "locked" in body.lower()
    assert " - " in subject
