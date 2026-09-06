from app.modules.payouts.domain.ip_risk import (
    ConnectionSnapshot,
    assess_ip_risk,
    can_approve_payout,
)


def test_vpn_without_vps_requires_invoice():
    risk = assess_ip_risk(
        ConnectionSnapshot("10.99.1.1", is_vpn=True, is_vps=False, connection_kind="vpn", connection_label="VPN")
    )
    assert risk.has_violation
    assert risk.requires_vps_invoice
    ok, reason = can_approve_payout(status="Pending", risk=risk, vps_invoice_status=None)
    assert not ok
    assert "VPS invoice" in reason


def test_vpn_with_received_invoice_can_approve():
    risk = assess_ip_risk(
        ConnectionSnapshot("10.99.1.1", is_vpn=True, is_vps=False, connection_kind="vpn", connection_label="VPN")
    )
    ok, _ = can_approve_payout(status="NeedsVpsInvoice", risk=risk, vps_invoice_status="Received")
    assert ok


def test_residential_ok():
    risk = assess_ip_risk(
        ConnectionSnapshot("1.2.3.4", False, False, "residential", "Residential / local")
    )
    assert not risk.has_violation
    ok, _ = can_approve_payout(status="Pending", risk=risk, vps_invoice_status=None)
    assert ok
