namespace PropFirm.Domain.Modules.Payouts;

public static class ProfitShare
{
    public static decimal GrossProfit(decimal equity, decimal accountSize) =>
        Math.Max(0m, Math.Round(equity - accountSize, 2));

    public static decimal ProfitShareCap(decimal equity, decimal accountSize, decimal profitSplitPct)
    {
        var split = Math.Clamp(profitSplitPct, 0m, 100m);
        return Math.Round(GrossProfit(equity, accountSize) * (split / 100m), 2);
    }

    public static decimal RemainingWithdrawable(decimal cap, decimal alreadyRequested) =>
        Math.Round(Math.Max(0m, cap - Math.Max(0m, alreadyRequested)), 2);
}

public sealed record ConnectionSnapshot(
    string? Ip,
    bool IsVpn,
    bool IsVps,
    string? ConnectionKind,
    string? ConnectionLabel);

public sealed record IpRiskAssessment(
    bool HasViolation,
    string Code,
    string Summary,
    bool RequiresVpsInvoice);

public static class IpRisk
{
    public static IpRiskAssessment Assess(ConnectionSnapshot? snap)
    {
        if (snap is null)
        {
            return new(false, "none", "No recent login history to evaluate.", false);
        }

        if (snap.IsVpn && !snap.IsVps)
        {
            return new(
                true,
                "vpn_no_vps",
                $"VPN/proxy detected on {snap.Ip ?? "unknown IP"} without an approved VPS. Request a VPS invoice before approving this payout.",
                true);
        }

        var kind = (snap.ConnectionKind ?? string.Empty).ToLowerInvariant();
        if ((kind is "datacenter" or "hosting") && !snap.IsVps)
        {
            return new(
                true,
                "datacenter_suspect",
                $"Datacenter/hosting IP detected ({snap.Ip ?? "unknown"}). Confirm VPS ownership with an invoice before approving.",
                true);
        }

        return new(
            false,
            "none",
            $"No IP violation ({snap.ConnectionLabel ?? snap.ConnectionKind ?? "ok"}).",
            false);
    }

    public static (bool Ok, string Reason) CanApprove(string status, IpRiskAssessment risk, string? vpsInvoiceStatus)
    {
        if (status is not ("Pending" or "NeedsVpsInvoice"))
            return (false, "payout is not awaiting approval");
        if (risk.RequiresVpsInvoice &&
            !string.Equals(vpsInvoiceStatus, "Received", StringComparison.OrdinalIgnoreCase))
            return (false, "IP violation: VPS invoice required before approval");
        return (true, string.Empty);
    }
}
