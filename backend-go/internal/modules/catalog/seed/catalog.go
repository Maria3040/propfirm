package seed

import (
	"fmt"

	"github.com/google/uuid"
)

type Product struct {
	ID               string
	SKU              string
	Name             string
	Description      string
	PhaseFamily      string
	Variant          string
	VariantTagline   string
	AccountSize      float64
	Price            float64
	ComparePrice     *float64
	Phases           int
	ProfitTargetPct  float64
	Phase1TargetPct  float64
	Phase2TargetPct  float64
	DailyLossPct     float64
	MaxLossPct       float64
	MinTradingDays   int
	ProfitSplitPct   float64
	RewardCycle      string
	AvgFirstReward   float64
	IsMostPopular    bool
	IsActive         bool
}

type sizeRow struct {
	size, price, avg float64
	compare          *float64
	popular          bool
}

func ptr(v float64) *float64 { return &v }

func sizeLabel(n float64) string {
	if n >= 1000 {
		return fmt.Sprintf("%.0fK", n/1000)
	}
	return fmt.Sprintf("%.0f", n)
}

// BuildCatalog returns ~30 challenge products matching Nest catalog-seed.
func BuildCatalog() []Product {
	twoStepFlex := []sizeRow{
		{5000, 32, 389, nil, false},
		{10000, 59, 743, nil, false},
		{25000, 159, 1661, nil, false},
		{50000, 269, 2471, nil, false},
		{100000, 499, 5020, ptr(555), true},
		{200000, 999, 10040, nil, false},
	}
	twoStepStd := []sizeRow{
		{5000, 36, 278, nil, false}, {10000, 66, 531, nil, false}, {25000, 179, 1187, nil, false},
		{50000, 299, 1766, nil, false}, {100000, 549, 3587, nil, false}, {200000, 1099, 7174, nil, false},
	}
	twoStepPro := []sizeRow{
		{5000, 29, 231, nil, false}, {10000, 55, 441, nil, false}, {25000, 134, 986, nil, false},
		{50000, 224, 1467, nil, false}, {100000, 422, 2980, nil, false}, {200000, 844, 5960, nil, false},
	}
	out := append(append(buildTwoStep("standard", "Highest Profit Split", 10, 5, 8, 5, 80, 3, "Biweekly", twoStepStd),
		buildTwoStep("flex", "Biggest Max Loss", 12, 4, 10, 6, 95, 1, "Bi-Weekly", twoStepFlex)...),
		buildTwoStep("pro", "Lowest Profit Target", 6, 3, 6, 6, 80, 2, "Weekly", twoStepPro)...)
	out = append(out, buildOneStepFlex()...)
	out = append(out, buildZero()...)
	return out
}

func buildTwoStep(variant, tagline string, maxLoss, daily, p1, p2, split float64, minDays int, cycle string, ladder []sizeRow) []Product {
	var out []Product
	for _, row := range ladder {
		nameVariant := variant
		if variant == "standard" {
			nameVariant = "Standard"
		} else if variant == "flex" {
			nameVariant = "Flex"
		} else if variant == "pro" {
			nameVariant = "Pro"
		}
		out = append(out, Product{
			ID: uuid.NewString(), SKU: fmt.Sprintf("2STEP-%s-%s", stringsUpper(variant), sizeLabel(row.size)),
			Name: fmt.Sprintf("2-Step %s $%s", nameVariant, sizeLabel(row.size)),
			Description: fmt.Sprintf("2-phase evaluation · %s", tagline),
			PhaseFamily: "two_step", Variant: variant, VariantTagline: tagline,
			AccountSize: row.size, Price: row.price, ComparePrice: row.compare, Phases: 2,
			ProfitTargetPct: p1, Phase1TargetPct: p1, Phase2TargetPct: p2,
			DailyLossPct: daily, MaxLossPct: maxLoss, MinTradingDays: minDays,
			ProfitSplitPct: split, RewardCycle: cycle, AvgFirstReward: row.avg,
			IsMostPopular: row.popular && variant == "flex", IsActive: true,
		})
	}
	return out
}

func stringsUpper(s string) string {
	b := []byte(s)
	for i := range b {
		if b[i] >= 'a' && b[i] <= 'z' {
			b[i] -= 32
		}
	}
	return string(b)
}

func buildOneStepFlex() []Product {
	sizes := []float64{5000, 10000, 25000, 50000, 100000, 200000}
	prices := []float64{66, 99, 199, 329, 599, 1199}
	avgs := []float64{350, 680, 1400, 2200, 4500, 9000}
	var out []Product
	for i, size := range sizes {
		out = append(out, Product{
			ID: uuid.NewString(), SKU: fmt.Sprintf("1STEP-FLEX-%s", sizeLabel(size)),
			Name: fmt.Sprintf("1-Step Flex $%s", sizeLabel(size)), Description: "Single-phase challenge · New",
			PhaseFamily: "one_step_flex", Variant: "flex", VariantTagline: "Biggest Max Loss",
			AccountSize: size, Price: prices[i], Phases: 1,
			ProfitTargetPct: 10, Phase1TargetPct: 10, Phase2TargetPct: 0,
			DailyLossPct: 4, MaxLossPct: 12, MinTradingDays: 0,
			ProfitSplitPct: 95, RewardCycle: "Bi-Weekly", AvgFirstReward: avgs[i],
			IsMostPopular: size == 100000, IsActive: true,
		})
	}
	return out
}

func buildZero() []Product {
	sizes := []float64{5000, 10000, 25000, 50000, 100000, 200000}
	prices := []float64{60, 99, 219, 379, 699, 1399}
	avgs := []float64{400, 800, 1700, 2800, 5500, 11000}
	var out []Product
	for i, size := range sizes {
		out = append(out, Product{
			ID: uuid.NewString(), SKU: fmt.Sprintf("ZERO-%s", sizeLabel(size)),
			Name: fmt.Sprintf("Zero $%s", sizeLabel(size)), Description: "Instant / zero-step path (simulated)",
			PhaseFamily: "zero", Variant: "standard", VariantTagline: "Highest Profit Split",
			AccountSize: size, Price: prices[i], Phases: 1,
			ProfitTargetPct: 0, Phase1TargetPct: 0, Phase2TargetPct: 0,
			DailyLossPct: 4, MaxLossPct: 10, MinTradingDays: 0,
			ProfitSplitPct: 85, RewardCycle: "Weekly", AvgFirstReward: avgs[i],
			IsMostPopular: size == 100000, IsActive: true,
		})
	}
	return out
}
