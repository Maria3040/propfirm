package domain

import "github.com/Maria3040/propfirm/backend-go/internal/sharedkernel"

const (
	StatusActive = "Active"
	StatusFailed = "Failed"
	StatusFunded = "Funded"
	StatusClosed = "Closed"
)

type Challenge struct {
	ID               string
	TraderID         string
	OrderID          string
	ProductID        string
	SKU              string
	AccountSize      float64
	Phases           int
	CurrentPhase     int
	ProfitTargetPct  float64
	Phase1TargetPct  float64
	Phase2TargetPct  float64
	DailyLossPct     float64
	MaxLossPct       float64
	MinTradingDays   int
	Status           string
	FailReason       string
}

func (c *Challenge) CurrentTargetPct() float64 {
	if c.CurrentPhase <= 1 {
		if c.Phase1TargetPct != 0 {
			return c.Phase1TargetPct
		}
		return c.ProfitTargetPct
	}
	if c.Phase2TargetPct != 0 {
		return c.Phase2TargetPct
	}
	return c.ProfitTargetPct
}

// MarkPhasePassed advances phase or funds. Returns "advanced" | "funded".
func (c *Challenge) MarkPhasePassed() (string, error) {
	if c.Status != StatusActive {
		return "", sharedkernel.NewDomainError("challenge not active")
	}
	if c.CurrentPhase < c.Phases {
		c.CurrentPhase++
		c.ProfitTargetPct = c.Phase2TargetPct
		return "advanced", nil
	}
	c.Status = StatusFunded
	return "funded", nil
}

func (c *Challenge) MarkFailed(reason string) {
	if c.Status == StatusFailed || c.Status == StatusFunded {
		return
	}
	c.Status = StatusFailed
	c.FailReason = reason
}
