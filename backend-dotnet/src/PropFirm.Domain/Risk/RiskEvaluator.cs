namespace PropFirm.Domain.Risk;

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

public sealed record RiskResult(string Kind, string Rule = "", string Reason = "");

/// <summary>Pure domain risk evaluation (no infrastructure).</summary>
public static class RiskEvaluator
{
    public static RiskResult Evaluate(RiskInput inp)
    {
        var dailyLimit = inp.StartingBalance * (inp.DailyLossPct / 100m);
        if (inp.DayPnl <= -dailyLimit)
        {
            return new RiskResult(
                "breach",
                "DailyLoss",
                $"Daily loss {inp.DayPnl:0.00} exceeded -{dailyLimit:0.00}");
        }

        var maxLossFloor = inp.StartingBalance * (1m - inp.MaxLossPct / 100m);
        if (inp.Equity < maxLossFloor)
        {
            return new RiskResult(
                "breach",
                "MaxDrawdown",
                $"Equity {inp.Equity:0.00} below floor {maxLossFloor:0.00}");
        }

        if (inp.MaxTradingDays > 0 && inp.TradingDays > inp.MaxTradingDays)
        {
            return new RiskResult(
                "breach",
                "MaxTradingDays",
                $"Trading days {inp.TradingDays} exceeded max {inp.MaxTradingDays}");
        }

        if (inp.ProfitTargetPct <= 0)
            return new RiskResult("ok");

        var target = inp.StartingBalance * (1m + inp.ProfitTargetPct / 100m);
        if (inp.Equity >= target && inp.TradingDays >= inp.MinTradingDays)
            return new RiskResult("target");

        return new RiskResult("ok");
    }
}
