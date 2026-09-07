using PropFirm.Domain.Modules.Commerce;
using PropFirm.Domain.Modules.Payouts;
using PropFirm.Domain.Modules.Risk;
using PropFirm.Domain.Modules.Admin;
using PropFirm.Domain.Modules.Challenges;
using PropFirm.SharedKernel;

namespace PropFirm.UnitTests;

public class RiskRulesTests
{
    [Fact]
    public void Daily_loss_breach()
    {
        var r = RiskRules.Evaluate(new RiskInput(10000, 9800, -600, 1, 8, 5, 10, 3));
        Assert.Equal("breach", r.Kind);
        Assert.Equal("DailyLoss", r.Rule);
    }

    [Fact]
    public void Max_drawdown_breach()
    {
        var r = RiskRules.Evaluate(new RiskInput(10000, 8900, 0, 2, 8, 5, 10, 3));
        Assert.Equal("breach", r.Kind);
        Assert.Equal("MaxDrawdown", r.Rule);
    }

    [Fact]
    public void Target_hit_when_days_met()
    {
        var r = RiskRules.Evaluate(new RiskInput(10000, 10850, 100, 3, 8, 5, 10, 3));
        Assert.Equal("target", r.Kind);
    }

    [Fact]
    public void Ok_when_below_target()
    {
        var r = RiskRules.Evaluate(new RiskInput(10000, 10100, 50, 2, 8, 5, 10, 3));
        Assert.Equal("ok", r.Kind);
    }
}

public class PricingTests
{
    [Fact]
    public void Apply_percent_coupon()
    {
        var q = Pricing.ApplyCoupon(Pricing.DemoCoupons["WELCOME10"], 100);
        Assert.Equal(10m, q.DiscountAmount);
        Assert.Equal(90m, q.FinalTotal);
    }

    [Fact]
    public void Expired_coupon_throws()
    {
        Assert.Throws<DomainError>(() => Pricing.ApplyCoupon(Pricing.DemoCoupons["EXPIRED"], 100));
    }

    [Fact]
    public void Ctrader_adds_platform_fee()
    {
        var (total, platform) = Pricing.PriceOrder(100, false, "ctrader", 1);
        Assert.Equal("ctrader", platform);
        Assert.Equal(120m, total);
    }
}

public class ProfitShareTests
{
    [Fact]
    public void Cap_uses_split()
    {
        Assert.Equal(80m, ProfitShare.ProfitShareCap(10100, 10000, 80));
    }

    [Fact]
    public void Remaining_never_negative()
    {
        Assert.Equal(0m, ProfitShare.RemainingWithdrawable(50, 80));
    }
}

public class IpRiskTests
{
    [Fact]
    public void Vpn_without_vps_requires_invoice()
    {
        var a = IpRisk.Assess(new ConnectionSnapshot("1.1.1.1", true, false, "vpn", "vpn"));
        Assert.True(a.RequiresVpsInvoice);
        var (ok, _) = IpRisk.CanApprove("Pending", a, null);
        Assert.False(ok);
    }

    [Fact]
    public void Received_invoice_allows_approve()
    {
        var a = IpRisk.Assess(new ConnectionSnapshot("1.1.1.1", true, false, "vpn", "vpn"));
        var (ok, _) = IpRisk.CanApprove("NeedsVpsInvoice", a, "Received");
        Assert.True(ok);
    }
}

public class ListQueryEdgeTests
{
    [Fact]
    public void Clamps_page_size_and_empty_total_pages()
    {
        var (page, size, dir) = ListQuery.Normalize(0, 500, "nope");
        Assert.Equal(1, page);
        Assert.Equal(100, size);
        Assert.Equal("desc", dir);
        var env = PageResult<int>.Create(Array.Empty<int>(), 1, 20, 0, "createdAt", "desc", null);
        Assert.Equal(1, env.TotalPages);
    }

    [Fact]
    public void Challenge_progression_rejects_closed()
    {
        Assert.Throws<DomainError>(() => ChallengeProgression.OnTargetHit(ChallengeStatuses.Closed, 1, 2));
    }

    [Fact]
    public void Challenge_progression_mid_phase_stays_active_for_auto_advance()
    {
        Assert.Equal(ChallengeStatuses.Active, ChallengeProgression.OnTargetHit(ChallengeStatuses.Active, 1, 2));
        Assert.Equal(ChallengeStatuses.Funded, ChallengeProgression.OnTargetHit(ChallengeStatuses.Active, 2, 2));
    }
}
