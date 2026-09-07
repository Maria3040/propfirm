namespace PropFirm.Domain.Modules.Risk;

/// <summary>Pure risk evaluation (prop firm challenge rules) — no infrastructure.</summary>
public sealed record RiskInput(
    decimal StartingBalance,
    decimal Equity,
    decimal DayPnl,
    int TradingDays,
    decimal ProfitTargetPct,
    decimal DailyLossPct,
    decimal MaxLossPct,
    int MinTradingDays,
    int MaxTradingDays = 0);

public sealed record RiskResult(string Kind, string Rule = "", string Reason = "")
{
    public static RiskResult Ok() => new("ok");
    public static RiskResult Breach(string rule, string reason) => new("breach", rule, reason);
    public static RiskResult Target() => new("target");
}

public static class RiskRules
{
    public static RiskResult Evaluate(RiskInput inp)
    {
        var dailyLimit = inp.StartingBalance * (inp.DailyLossPct / 100m);
        if (inp.DayPnl <= -dailyLimit)
        {
            return RiskResult.Breach(
                "DailyLoss",
                $"Daily loss {inp.DayPnl:F2} exceeded -{dailyLimit:F2}");
        }

        var maxLossFloor = inp.StartingBalance * (1m - inp.MaxLossPct / 100m);
        if (inp.Equity < maxLossFloor)
        {
            return RiskResult.Breach(
                "MaxDrawdown",
                $"Equity {inp.Equity:F2} below floor {maxLossFloor:F2}");
        }

        if (inp.MaxTradingDays > 0 && inp.TradingDays > inp.MaxTradingDays)
        {
            return RiskResult.Breach(
                "MaxTradingDays",
                $"Trading days {inp.TradingDays} exceeded max {inp.MaxTradingDays}");
        }

        // Funded / Zero products often have no profit target — skip Target (0% would equal starting balance).
        if (inp.ProfitTargetPct <= 0)
            return RiskResult.Ok();

        var target = inp.StartingBalance * (1m + inp.ProfitTargetPct / 100m);
        if (inp.Equity >= target && inp.TradingDays >= inp.MinTradingDays)
            return RiskResult.Target();

        return RiskResult.Ok();
    }
}
