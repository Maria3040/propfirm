package domain

import "testing"

func TestEvaluateDailyLoss(t *testing.T) {
	r := Evaluate(Input{
		StartingBalance: 100000, Equity: 99000, DayPnl: -6000,
		DailyLossPct: 5, MaxLossPct: 10, ProfitTargetPct: 8, MinTradingDays: 3, TradingDays: 1,
	})
	if r.Kind != KindBreach || r.Rule != "DailyLoss" {
		t.Fatalf("got %+v", r)
	}
}

func TestEvaluateMaxDrawdown(t *testing.T) {
	r := Evaluate(Input{
		StartingBalance: 100000, Equity: 89000, DayPnl: -100,
		DailyLossPct: 5, MaxLossPct: 10, ProfitTargetPct: 8, MinTradingDays: 3, TradingDays: 2,
	})
	if r.Kind != KindBreach || r.Rule != "MaxDrawdown" {
		t.Fatalf("got %+v", r)
	}
}

func TestEvaluateTarget(t *testing.T) {
	r := Evaluate(Input{
		StartingBalance: 100000, Equity: 108000, DayPnl: 200,
		DailyLossPct: 5, MaxLossPct: 10, ProfitTargetPct: 8, MinTradingDays: 3, TradingDays: 3,
	})
	if r.Kind != KindTarget {
		t.Fatalf("got %+v", r)
	}
}

func TestEvaluateTargetNeedsDays(t *testing.T) {
	r := Evaluate(Input{
		StartingBalance: 100000, Equity: 108000, DayPnl: 200,
		DailyLossPct: 5, MaxLossPct: 10, ProfitTargetPct: 8, MinTradingDays: 3, TradingDays: 1,
	})
	if r.Kind != KindOK {
		t.Fatalf("got %+v", r)
	}
}
