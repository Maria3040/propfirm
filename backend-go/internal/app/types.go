package app

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

func newID() string { return uuid.NewString() }

func mustJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func round2(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}

type principal struct {
	Sub   string
	Email string
	Role  string
}

type productRow struct {
	ID              string
	SKU             string
	Name            string
	Description     *string
	PhaseFamily     string
	Variant         string
	VariantTagline  *string
	AccountSize     float64
	Price           float64
	ComparePrice    *float64
	Phases          int
	ProfitTargetPct float64
	Phase1TargetPct float64
	Phase2TargetPct float64
	DailyLossPct    float64
	MaxLossPct      float64
	MinTradingDays  int
	ProfitSplitPct  float64
	RewardCycle     string
	AvgFirstReward  float64
	IsMostPopular   bool
}

func (p productRow) DTO() map[string]any {
	return map[string]any{
		"id": p.ID, "sku": p.SKU, "name": p.Name, "description": p.Description,
		"phaseFamily": p.PhaseFamily, "variant": p.Variant, "variantTagline": p.VariantTagline,
		"accountSize": p.AccountSize, "price": p.Price, "comparePrice": p.ComparePrice,
		"phases": p.Phases, "profitTargetPct": p.ProfitTargetPct,
		"phase1TargetPct": p.Phase1TargetPct, "phase2TargetPct": p.Phase2TargetPct,
		"dailyLossPct": p.DailyLossPct, "maxLossPct": p.MaxLossPct, "minTradingDays": p.MinTradingDays,
		"profitSplitPct": p.ProfitSplitPct, "rewardCycle": p.RewardCycle,
		"avgFirstReward": p.AvgFirstReward, "isMostPopular": p.IsMostPopular,
	}
}

type orderRow struct {
	ID              string
	TraderID        string
	ProductID       string
	SKU             string
	Price           float64
	AccountSize     float64
	Phases          int
	ProfitTargetPct float64
	Phase1TargetPct float64
	Phase2TargetPct float64
	DailyLossPct    float64
	MaxLossPct      float64
	MinTradingDays  int
	AddonSwapFree   bool
	Platform        string
	Status          string
	PaymentIntentID *string
	CreatedAt       time.Time
	PaidAt          *time.Time
}

type challengeRow struct {
	ID              string
	TraderID        string
	OrderID         string
	ProductID       string
	SKU             string
	AccountSize     float64
	Phases          int
	CurrentPhase    int
	ProfitTargetPct float64
	Phase1TargetPct float64
	Phase2TargetPct float64
	DailyLossPct    float64
	MaxLossPct      float64
	MinTradingDays  int
	Status          string
	FailReason      *string
	CreatedAt       time.Time
}

func (c challengeRow) Map() map[string]any {
	return map[string]any{
		"id": c.ID, "traderId": c.TraderID, "orderId": c.OrderID, "productId": c.ProductID,
		"sku": c.SKU, "accountSize": c.AccountSize, "phases": c.Phases, "currentPhase": c.CurrentPhase,
		"profitTargetPct": c.ProfitTargetPct, "phase1TargetPct": c.Phase1TargetPct, "phase2TargetPct": c.Phase2TargetPct,
		"dailyLossPct": c.DailyLossPct, "maxLossPct": c.MaxLossPct, "minTradingDays": c.MinTradingDays,
		"status": c.Status, "failReason": c.FailReason, "createdAt": c.CreatedAt,
	}
}

type accountRow struct {
	ID              string
	ChallengeID     string
	TraderID        string
	Login           string
	Password        string
	Platform        string
	Server          string
	StartingBalance float64
	Equity          float64
	HighWaterMark   float64
	Locked          bool
	CreatedAt       time.Time
}
