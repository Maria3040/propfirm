package domain

import "fmt"

type Input struct {
	ChallengeID     string
	StartingBalance float64
	Equity          float64
	HighWaterMark   float64
	DayPnl          float64
	TradingDays     int
	ProfitTargetPct float64
	DailyLossPct    float64
	MaxLossPct      float64
	MinTradingDays  int
}

type ResultKind string

const (
	KindOK     ResultKind = "ok"
	KindBreach ResultKind = "breach"
	KindTarget ResultKind = "target"
)

type Result struct {
	Kind         ResultKind
	Rule         string
	Reason       string
	Equity       float64
	TradingDays  int
}

// Evaluate applies prop-firm risk rules (pure — no I/O).
func Evaluate(in Input) Result {
	dailyLimit := in.StartingBalance * (in.DailyLossPct / 100)
	if in.DayPnl <= -dailyLimit {
		return Result{
			Kind:   KindBreach,
			Rule:   "DailyLoss",
			Reason: fmt.Sprintf("Daily loss %.2f exceeded -%.2f", in.DayPnl, dailyLimit),
		}
	}
	maxLossFloor := in.StartingBalance * (1 - in.MaxLossPct/100)
	if in.Equity < maxLossFloor {
		return Result{
			Kind:   KindBreach,
			Rule:   "MaxDrawdown",
			Reason: fmt.Sprintf("Equity %.2f below floor %.2f", in.Equity, maxLossFloor),
		}
	}
	target := in.StartingBalance * (1 + in.ProfitTargetPct/100)
	if in.Equity >= target && in.TradingDays >= in.MinTradingDays {
		return Result{Kind: KindTarget, Equity: in.Equity, TradingDays: in.TradingDays}
	}
	return Result{Kind: KindOK}
}
