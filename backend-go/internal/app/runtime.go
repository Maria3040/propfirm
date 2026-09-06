package app

import (
	"context"
	"time"

	challengedom "github.com/Maria3040/propfirm/backend-go/internal/modules/challenges/domain"
	riskdom "github.com/Maria3040/propfirm/backend-go/internal/modules/risk/domain"
	tradingdom "github.com/Maria3040/propfirm/backend-go/internal/modules/trading/domain"
	payoutdom "github.com/Maria3040/propfirm/backend-go/internal/modules/payouts/domain"
)

const (
	evtOrderPaid         = "OrderPaid"
	evtChallengeStarted  = "ChallengeStarted"
	evtTradeRecorded     = "TradeRecorded"
	evtChallengeFunded   = "ChallengeFunded"
	evtChallengeFailed   = "ChallengeFailed"
	evtPayoutCompleted   = "PayoutCompleted"
	evtCompetitionJoined = "CompetitionJoined"
	evtUserRegistered    = "UserRegistered"
)

func (a *App) wireBus() {
	a.Bus.Subscribe(evtOrderPaid, func(ev any) error {
		e := ev.(orderPaidEvent)
		return a.onOrderPaid(context.Background(), e)
	})
	a.Bus.Subscribe(evtChallengeStarted, func(ev any) error {
		e := ev.(challengeStartedEvent)
		ctx := context.Background()
		email := a.traderEmail(ctx, e.TraderID)
		a.notify(ctx, email, "Trading account ready",
			"Login: "+e.Login+"\nPassword: "+e.Password+"\nPlatform: "+e.Platform+"\nServer: "+e.Server)
		a.audit(ctx, evtChallengeStarted, "trading", "Account provisioned for challenge "+e.ChallengeID, e)
		return nil
	})
	a.Bus.Subscribe(evtChallengeFunded, func(ev any) error {
		e := ev.(map[string]any)
		ctx := context.Background()
		traderID, _ := e["traderId"].(string)
		a.notify(ctx, a.traderEmail(ctx, traderID), "Challenge funded", "Congratulations — your account is funded.")
		a.audit(ctx, evtChallengeFunded, "challenges", "Challenge funded", e)
		return nil
	})
	a.Bus.Subscribe(evtChallengeFailed, func(ev any) error {
		e := ev.(map[string]any)
		ctx := context.Background()
		traderID, _ := e["traderId"].(string)
		reason, _ := e["reason"].(string)
		a.notify(ctx, a.traderEmail(ctx, traderID), "Challenge failed", reason)
		a.audit(ctx, evtChallengeFailed, "risk", "Challenge failed", e)
		return nil
	})
	a.Bus.Subscribe(evtPayoutCompleted, func(ev any) error {
		e := ev.(map[string]any)
		ctx := context.Background()
		traderID, _ := e["traderId"].(string)
		a.notify(ctx, a.traderEmail(ctx, traderID), "Payout approved", "Your payout request was approved.")
		a.audit(ctx, evtPayoutCompleted, "payouts", "Payout approved", e)
		return nil
	})
	a.Bus.Subscribe(evtCompetitionJoined, func(ev any) error {
		e := ev.(map[string]any)
		ctx := context.Background()
		traderID, _ := e["traderId"].(string)
		title, _ := e["title"].(string)
		a.notify(ctx, a.traderEmail(ctx, traderID), "Competition joined", "You joined: "+title)
		a.audit(ctx, evtCompetitionJoined, "competitions", "Joined competition", e)
		return nil
	})
	a.Bus.Subscribe(evtUserRegistered, func(ev any) error {
		a.audit(context.Background(), evtUserRegistered, "users", "User registered", ev)
		return nil
	})
}

type orderPaidEvent struct {
	Order orderRow
}

type challengeStartedEvent struct {
	ChallengeID, TraderID, Login, Password, Platform, Server string
}

func (a *App) onOrderPaid(ctx context.Context, e orderPaidEvent) error {
	o := e.Order
	var existing string
	err := a.DB.QueryRow(ctx, `SELECT id FROM challenges.challenge_instances WHERE order_id=$1`, o.ID).Scan(&existing)
	if err == nil {
		return nil
	}
	chID := newID()
	now := time.Now().UTC()
	_, err = a.DB.Exec(ctx, `
		INSERT INTO challenges.challenge_instances (
			id, trader_id, order_id, product_id, sku, account_size, phases, current_phase,
			profit_target_pct, phase1_target_pct, phase2_target_pct, daily_loss_pct, max_loss_pct, min_trading_days,
			status, fail_reason, created_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10,$11,$12,$13,'Active',NULL,$14)`,
		chID, o.TraderID, o.ID, o.ProductID, o.SKU, o.AccountSize, o.Phases,
		o.ProfitTargetPct, o.Phase1TargetPct, o.Phase2TargetPct, o.DailyLossPct, o.MaxLossPct, o.MinTradingDays, now)
	if err != nil {
		return err
	}
	acc := tradingdom.Provision(chID, o.TraderID, o.AccountSize, o.Platform)
	_, err = a.DB.Exec(ctx, `
		INSERT INTO trading.trading_accounts (
			id, challenge_id, trader_id, login, password, platform, server, starting_balance, equity, high_water_mark, locked, created_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11)`,
		acc.ID, chID, o.TraderID, acc.Login, acc.Password, acc.Platform, acc.Server, acc.StartingBalance, acc.Equity, acc.HighWaterMark, now)
	if err != nil {
		return err
	}
	return a.Bus.Publish(evtChallengeStarted, challengeStartedEvent{
		ChallengeID: chID, TraderID: o.TraderID, Login: acc.Login, Password: acc.Password, Platform: acc.Platform, Server: acc.Server,
	})
}

func (a *App) simulateTrade(ctx context.Context, challengeID string, symbol, side string, lots, pnl float64) (map[string]any, error) {
	ch, err := a.getChallenge(ctx, challengeID)
	if err != nil {
		return nil, err
	}
	if ch.Status != challengedom.StatusActive {
		return nil, errMsg("challenge not active")
	}
	acc, err := a.getAccountByChallenge(ctx, challengeID)
	if err != nil {
		return nil, err
	}
	domainAcc := tradingdom.Account{
		ID: acc.ID, ChallengeID: acc.ChallengeID, TraderID: acc.TraderID, Locked: acc.Locked,
		Equity: acc.Equity, HighWaterMark: acc.HighWaterMark, StartingBalance: acc.StartingBalance,
	}
	if err := domainAcc.ApplyTrade(pnl); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	tradeID := newID()
	if symbol == "" {
		symbol = "EURUSD"
	}
	if side == "" {
		side = "buy"
	}
	if lots <= 0 {
		lots = 1
	}
	_, err = a.DB.Exec(ctx, `
		INSERT INTO trading.trades (id, account_id, challenge_id, symbol, side, lots, pnl, equity_after, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		tradeID, acc.ID, challengeID, symbol, side, lots, pnl, domainAcc.Equity, now)
	if err != nil {
		return nil, err
	}
	_, err = a.DB.Exec(ctx, `
		UPDATE trading.trading_accounts SET equity=$2, high_water_mark=$3 WHERE id=$1`,
		acc.ID, domainAcc.Equity, domainAcc.HighWaterMark)
	if err != nil {
		return nil, err
	}

	dayKey := now.UTC().Format("2006-01-02")
	var dayPnl float64
	_ = a.DB.QueryRow(ctx, `
		SELECT COALESCE(SUM(pnl),0) FROM trading.trades
		WHERE challenge_id=$1 AND created_at::date = $2::date`, challengeID, dayKey).Scan(&dayPnl)
	var tradingDays int
	_ = a.DB.QueryRow(ctx, `
		SELECT COUNT(DISTINCT created_at::date) FROM trading.trades WHERE challenge_id=$1`, challengeID).Scan(&tradingDays)

	_, _ = a.DB.Exec(ctx, `
		INSERT INTO trading.equity_snapshots (challenge_id, equity, day_pnl, trading_days, created_at)
		VALUES ($1,$2,$3,$4,$5)`, challengeID, domainAcc.Equity, dayPnl, tradingDays, now)

	targetPct := ch.Phase1TargetPct
	if ch.CurrentPhase > 1 {
		targetPct = ch.Phase2TargetPct
	}
	if targetPct == 0 {
		targetPct = ch.ProfitTargetPct
	}
	result := riskdom.Evaluate(riskdom.Input{
		ChallengeID: challengeID, StartingBalance: acc.StartingBalance, Equity: domainAcc.Equity,
		HighWaterMark: domainAcc.HighWaterMark, DayPnl: dayPnl, TradingDays: tradingDays,
		ProfitTargetPct: targetPct, DailyLossPct: ch.DailyLossPct, MaxLossPct: ch.MaxLossPct, MinTradingDays: ch.MinTradingDays,
	})

	status := ch.Status
	switch result.Kind {
	case riskdom.KindBreach:
		dom := challengedom.Challenge{Status: ch.Status}
		dom.MarkFailed(result.Reason)
		_, _ = a.DB.Exec(ctx, `UPDATE challenges.challenge_instances SET status=$2, fail_reason=$3 WHERE id=$1`, challengeID, dom.Status, result.Reason)
		_, _ = a.DB.Exec(ctx, `UPDATE trading.trading_accounts SET locked=true WHERE id=$1`, acc.ID)
		_, _ = a.DB.Exec(ctx, `INSERT INTO risk.breach_records (id, challenge_id, rule, reason, created_at) VALUES ($1,$2,$3,$4,$5)`,
			newID(), challengeID, result.Rule, result.Reason, now)
		status = dom.Status
		_ = a.Bus.Publish(evtChallengeFailed, map[string]any{"traderId": ch.TraderID, "challengeId": challengeID, "reason": result.Reason, "rule": result.Rule})
	case riskdom.KindTarget:
		dom := challengedom.Challenge{
			Status: ch.Status, CurrentPhase: ch.CurrentPhase, Phases: ch.Phases,
			Phase2TargetPct: ch.Phase2TargetPct, ProfitTargetPct: ch.ProfitTargetPct,
		}
		outcome, _ := dom.MarkPhasePassed()
		if outcome == "advanced" {
			_, _ = a.DB.Exec(ctx, `UPDATE challenges.challenge_instances SET current_phase=$2, profit_target_pct=$3 WHERE id=$1`,
				challengeID, dom.CurrentPhase, dom.ProfitTargetPct)
			_, _ = a.DB.Exec(ctx, `UPDATE trading.trading_accounts SET equity=$2, starting_balance=$2, high_water_mark=$2, locked=false WHERE id=$1`,
				acc.ID, ch.AccountSize)
			domainAcc.Equity = ch.AccountSize
			status = challengedom.StatusActive
		} else if outcome == "funded" {
			_, _ = a.DB.Exec(ctx, `UPDATE challenges.challenge_instances SET status='Funded' WHERE id=$1`, challengeID)
			credit := ch.AccountSize * 0.1
			_ = a.creditWallet(ctx, ch.TraderID, credit)
			status = challengedom.StatusFunded
			_ = a.Bus.Publish(evtChallengeFunded, map[string]any{"traderId": ch.TraderID, "challengeId": challengeID, "credit": credit})
		}
	}

	return map[string]any{
		"trade": map[string]any{
			"id": tradeID, "symbol": symbol, "side": side, "lots": lots, "pnl": pnl, "equityAfter": domainAcc.Equity, "createdAt": now,
		},
		"equity":          domainAcc.Equity,
		"challengeStatus": status,
	}, nil
}

func (a *App) creditWallet(ctx context.Context, traderID string, amount float64) error {
	now := time.Now().UTC()
	var bal float64
	err := a.DB.QueryRow(ctx, `SELECT available_balance FROM payouts.trader_wallets WHERE trader_id=$1`, traderID).Scan(&bal)
	if err != nil {
		_, err = a.DB.Exec(ctx, `INSERT INTO payouts.trader_wallets (trader_id, available_balance, updated_at) VALUES ($1,$2,$3)`, traderID, amount, now)
		return err
	}
	w := payoutdom.Wallet{TraderID: traderID, AvailableBalance: bal}
	if err := w.Credit(amount); err != nil {
		return err
	}
	_, err = a.DB.Exec(ctx, `UPDATE payouts.trader_wallets SET available_balance=$2, updated_at=$3 WHERE trader_id=$1`, traderID, w.AvailableBalance, now)
	return err
}

type simpleError string

func (e simpleError) Error() string { return string(e) }
func errMsg(s string) error         { return simpleError(s) }
