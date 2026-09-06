"""IP / connection risk rules for payout compliance (pure domain)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ConnectionSnapshot:
    ip: str | None
    is_vpn: bool
    is_vps: bool
    connection_kind: str | None
    connection_label: str | None


@dataclass(frozen=True)
class IpRiskAssessment:
    has_violation: bool
    code: str  # none | vpn_no_vps | datacenter_suspect
    summary: str
    requires_vps_invoice: bool


def assess_ip_risk(snap: ConnectionSnapshot | None) -> IpRiskAssessment:
    if snap is None:
        return IpRiskAssessment(
            False,
            "none",
            "No recent login history to evaluate.",
            False,
        )
    if snap.is_vpn and not snap.is_vps:
        return IpRiskAssessment(
            True,
            "vpn_no_vps",
            f"VPN/proxy detected on {snap.ip or 'unknown IP'} without an approved VPS. "
            "Request a VPS invoice before approving this payout.",
            True,
        )
    if (snap.connection_kind or "").lower() in {"datacenter", "hosting"} and not snap.is_vps:
        return IpRiskAssessment(
            True,
            "datacenter_suspect",
            f"Datacenter/hosting IP detected ({snap.ip or 'unknown'}). "
            "Confirm VPS ownership with an invoice before approving.",
            True,
        )
    return IpRiskAssessment(
        False,
        "none",
        f"No IP violation ({snap.connection_label or snap.connection_kind or 'ok'}).",
        False,
    )


def can_approve_payout(*, status: str, risk: IpRiskAssessment, vps_invoice_status: str | None) -> tuple[bool, str]:
    """Gate approve when IP risk requires VPS invoice proof."""
    if status not in {"Pending", "NeedsVpsInvoice"}:
        return False, "payout is not awaiting approval"
    if risk.requires_vps_invoice and (vps_invoice_status or "").lower() != "received":
        return False, "IP violation: VPS invoice required before approval"
    return True, ""
