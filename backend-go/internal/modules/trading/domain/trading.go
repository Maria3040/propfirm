package domain

import (
	"fmt"
	"math"
	"strings"

	"github.com/Maria3040/propfirm/backend-go/internal/sharedkernel"
	"github.com/google/uuid"
)

type Account struct {
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
}

func Provision(challengeID, traderID string, accountSize float64, platform string) Account {
	p := strings.ToLower(platform)
	if p != "mt5" && p != "matchtrader" && p != "ctrader" {
		p = "mt5"
	}
	id := uuid.NewString()
	short := strings.ReplaceAll(id, "-", "")[:8]
	login := loginFor(p, short)
	server := map[string]string{
		"mt5":         "PropFirm-Demo-MT5",
		"matchtrader": "PropFirm-MatchTrader",
		"ctrader":     "PropFirm-cTrader",
	}[p]
	return Account{
		ID:              id,
		ChallengeID:     challengeID,
		TraderID:        traderID,
		Login:           login,
		Password:        fmt.Sprintf("Pwd_%s!", short[:6]),
		Platform:        p,
		Server:          server,
		StartingBalance: accountSize,
		Equity:          accountSize,
		HighWaterMark:   accountSize,
		Locked:          false,
	}
}

func loginFor(platform, short string) string {
	switch platform {
	case "mt5":
		n := 10000000
		for _, c := range short {
			n = (n + int(c)*13) % 89999999
		}
		return fmt.Sprintf("%d", 10000000+n)
	case "matchtrader":
		return "mt_" + short
	case "ctrader":
		return "ct" + short[:7]
	default:
		return "PF" + short
	}
}

func (a *Account) ApplyTrade(pnl float64) error {
	if a.Locked {
		return sharedkernel.NewDomainError("account locked")
	}
	a.Equity = math.Round((a.Equity+pnl)*100) / 100
	if a.Equity > a.HighWaterMark {
		a.HighWaterMark = a.Equity
	}
	return nil
}
