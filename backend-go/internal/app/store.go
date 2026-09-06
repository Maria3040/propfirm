package app

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

func (a *App) getChallenge(ctx context.Context, id string) (challengeRow, error) {
	var c challengeRow
	err := a.DB.QueryRow(ctx, `
		SELECT id, trader_id, order_id, product_id, sku, account_size, phases, current_phase,
			profit_target_pct, phase1_target_pct, phase2_target_pct, daily_loss_pct, max_loss_pct, min_trading_days,
			status, fail_reason, created_at
		FROM challenges.challenge_instances WHERE id=$1`, id).Scan(
		&c.ID, &c.TraderID, &c.OrderID, &c.ProductID, &c.SKU, &c.AccountSize, &c.Phases, &c.CurrentPhase,
		&c.ProfitTargetPct, &c.Phase1TargetPct, &c.Phase2TargetPct, &c.DailyLossPct, &c.MaxLossPct, &c.MinTradingDays,
		&c.Status, &c.FailReason, &c.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return c, errMsg("not found")
	}
	return c, err
}

func (a *App) getAccountByChallenge(ctx context.Context, challengeID string) (accountRow, error) {
	var acc accountRow
	err := a.DB.QueryRow(ctx, `
		SELECT id, challenge_id, trader_id, login, password, platform, server, starting_balance, equity, high_water_mark, locked, created_at
		FROM trading.trading_accounts WHERE challenge_id=$1`, challengeID).Scan(
		&acc.ID, &acc.ChallengeID, &acc.TraderID, &acc.Login, &acc.Password, &acc.Platform, &acc.Server,
		&acc.StartingBalance, &acc.Equity, &acc.HighWaterMark, &acc.Locked, &acc.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return acc, errMsg("account not found")
	}
	return acc, err
}

func (a *App) getOrder(ctx context.Context, id string) (orderRow, error) {
	var o orderRow
	err := a.DB.QueryRow(ctx, `
		SELECT id, trader_id, product_id, sku, price, account_size, phases, profit_target_pct, phase1_target_pct, phase2_target_pct,
			daily_loss_pct, max_loss_pct, min_trading_days, addon_swap_free, platform, status, payment_intent_id, created_at, paid_at
		FROM commerce.orders WHERE id=$1`, id).Scan(
		&o.ID, &o.TraderID, &o.ProductID, &o.SKU, &o.Price, &o.AccountSize, &o.Phases, &o.ProfitTargetPct, &o.Phase1TargetPct, &o.Phase2TargetPct,
		&o.DailyLossPct, &o.MaxLossPct, &o.MinTradingDays, &o.AddonSwapFree, &o.Platform, &o.Status, &o.PaymentIntentID, &o.CreatedAt, &o.PaidAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return o, errMsg("not found")
	}
	return o, err
}

func (a *App) getProduct(ctx context.Context, id string) (productRow, error) {
	var p productRow
	err := a.DB.QueryRow(ctx, `
		SELECT id, sku, name, description, phase_family, variant, variant_tagline, account_size, price, compare_price, phases,
			profit_target_pct, phase1_target_pct, phase2_target_pct, daily_loss_pct, max_loss_pct, min_trading_days,
			profit_split_pct, reward_cycle, avg_first_reward, is_most_popular
		FROM catalog.challenge_products WHERE id=$1`, id).Scan(
		&p.ID, &p.SKU, &p.Name, &p.Description, &p.PhaseFamily, &p.Variant, &p.VariantTagline, &p.AccountSize, &p.Price, &p.ComparePrice, &p.Phases,
		&p.ProfitTargetPct, &p.Phase1TargetPct, &p.Phase2TargetPct, &p.DailyLossPct, &p.MaxLossPct, &p.MinTradingDays,
		&p.ProfitSplitPct, &p.RewardCycle, &p.AvgFirstReward, &p.IsMostPopular,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, errMsg("not found")
	}
	return p, err
}
