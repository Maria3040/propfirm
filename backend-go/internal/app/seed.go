package app

import (
	"context"
	"fmt"
	"time"

	"github.com/Maria3040/propfirm/backend-go/internal/modules/catalog/seed"
	tradingdom "github.com/Maria3040/propfirm/backend-go/internal/modules/trading/domain"
	"golang.org/x/crypto/bcrypt"
)

func (a *App) Seed(ctx context.Context) error {
	var n int
	if err := a.DB.QueryRow(ctx, `SELECT COUNT(*) FROM catalog.challenge_products`).Scan(&n); err != nil {
		return err
	}
	if n < 25 {
		for _, p := range seed.BuildCatalog() {
			_, err := a.DB.Exec(ctx, `
				INSERT INTO catalog.challenge_products (
					id, sku, name, description, phase_family, variant, variant_tagline,
					account_size, price, compare_price, phases, profit_target_pct, phase1_target_pct, phase2_target_pct,
					daily_loss_pct, max_loss_pct, min_trading_days, profit_split_pct, reward_cycle, avg_first_reward,
					is_most_popular, is_active
				) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
				ON CONFLICT (sku) DO NOTHING`,
				p.ID, p.SKU, p.Name, p.Description, p.PhaseFamily, p.Variant, p.VariantTagline,
				p.AccountSize, p.Price, p.ComparePrice, p.Phases, p.ProfitTargetPct, p.Phase1TargetPct, p.Phase2TargetPct,
				p.DailyLossPct, p.MaxLossPct, p.MinTradingDays, p.ProfitSplitPct, p.RewardCycle, p.AvgFirstReward,
				p.IsMostPopular, p.IsActive,
			)
			if err != nil {
				return err
			}
		}
	}

	if err := a.ensureUser(ctx, "trader@propfirm.local", "Trader1!", "Demo Trader", "Trader"); err != nil {
		return err
	}
	if err := a.ensureUser(ctx, "admin@propfirm.local", "Admin1!", "Admin", "Admin"); err != nil {
		return err
	}
	return a.seedFundedDemo(ctx)
}

func (a *App) ensureUser(ctx context.Context, email, password, display, role string) error {
	var id string
	err := a.DB.QueryRow(ctx, `SELECT id FROM users.traders WHERE LOWER(email)=LOWER($1)`, email).Scan(&id)
	if err == nil {
		return nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	if err != nil {
		return err
	}
	_, err = a.DB.Exec(ctx, `
		INSERT INTO users.traders (id, email, password_hash, display_name, role, created_at)
		VALUES ($1,$2,$3,$4,$5,$6)`, newID(), email, string(hash), display, role, time.Now().UTC())
	return err
}

func (a *App) seedFundedDemo(ctx context.Context) error {
	const orderID = "seed-order-funded-demo"
	var existing string
	err := a.DB.QueryRow(ctx, `SELECT id FROM challenges.challenge_instances WHERE order_id=$1`, orderID).Scan(&existing)
	if err == nil {
		return a.ensureWalletMin(ctx)
	}
	var traderID string
	if err := a.DB.QueryRow(ctx, `SELECT id FROM users.traders WHERE LOWER(email)=LOWER($1)`, "trader@propfirm.local").Scan(&traderID); err != nil {
		return err
	}
	var productID, sku string
	_ = a.DB.QueryRow(ctx, `SELECT id, sku FROM catalog.challenge_products WHERE account_size=100000 AND phase_family='two_step' AND variant='standard' LIMIT 1`).Scan(&productID, &sku)
	if productID == "" {
		productID = newID()
		sku = "SEED-100K"
	}
	now := time.Now().UTC()
	_, _ = a.DB.Exec(ctx, `
		INSERT INTO commerce.orders (id, trader_id, product_id, sku, price, account_size, phases, profit_target_pct, phase1_target_pct, phase2_target_pct,
			daily_loss_pct, max_loss_pct, min_trading_days, addon_swap_free, platform, status, payment_intent_id, created_at, paid_at)
		VALUES ($1,$2,$3,$4,0,100000,2,5,8,5,5,10,3,false,'mt5','Paid',$5,$6,$6)
		ON CONFLICT (id) DO NOTHING`, orderID, traderID, productID, sku, "pi_seed", now)

	chID := newID()
	_, err = a.DB.Exec(ctx, `
		INSERT INTO challenges.challenge_instances (
			id, trader_id, order_id, product_id, sku, account_size, phases, current_phase,
			profit_target_pct, phase1_target_pct, phase2_target_pct, daily_loss_pct, max_loss_pct, min_trading_days,
			status, fail_reason, created_at
		) VALUES ($1,$2,$3,$4,$5,100000,2,3,5,8,5,5,10,3,'Funded',NULL,$6)
		ON CONFLICT (order_id) DO NOTHING`, chID, traderID, orderID, productID, sku, now)
	if err != nil {
		return err
	}
	_ = a.DB.QueryRow(ctx, `SELECT id FROM challenges.challenge_instances WHERE order_id=$1`, orderID).Scan(&chID)

	acc := tradingdom.Provision(chID, traderID, 100000, "mt5")
	acc.Equity = 112000
	acc.HighWaterMark = 112000
	acc.Password = "FundedDemo1!"
	_, err = a.DB.Exec(ctx, `
		INSERT INTO trading.trading_accounts (
			id, challenge_id, trader_id, login, password, platform, server, starting_balance, equity, high_water_mark, locked, created_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11)
		ON CONFLICT (challenge_id) DO NOTHING`,
		acc.ID, chID, traderID, acc.Login, acc.Password, acc.Platform, acc.Server, acc.StartingBalance, acc.Equity, acc.HighWaterMark, now)
	if err != nil {
		return err
	}
	return a.ensureWalletMin(ctx)
}

func (a *App) ensureWalletMin(ctx context.Context) error {
	var traderID string
	if err := a.DB.QueryRow(ctx, `SELECT id FROM users.traders WHERE LOWER(email)=LOWER($1)`, "trader@propfirm.local").Scan(&traderID); err != nil {
		return err
	}
	var bal float64
	err := a.DB.QueryRow(ctx, `SELECT available_balance FROM payouts.trader_wallets WHERE trader_id=$1`, traderID).Scan(&bal)
	now := time.Now().UTC()
	if err != nil {
		_, err = a.DB.Exec(ctx, `INSERT INTO payouts.trader_wallets (trader_id, available_balance, updated_at) VALUES ($1,2500,$2)`, traderID, now)
		return err
	}
	if bal < 100 {
		_, err = a.DB.Exec(ctx, `UPDATE payouts.trader_wallets SET available_balance=available_balance+2500, updated_at=$2 WHERE trader_id=$1`, traderID, now)
	}
	return err
}

func (a *App) traderEmail(ctx context.Context, traderID string) string {
	var email string
	_ = a.DB.QueryRow(ctx, `SELECT email FROM users.traders WHERE id=$1`, traderID).Scan(&email)
	return email
}

func fmtMoney(v float64) string { return fmt.Sprintf("%.2f", v) }
