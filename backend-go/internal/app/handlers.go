package app

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Maria3040/propfirm/backend-go/internal/modules/commerce/domain"
	"github.com/Maria3040/propfirm/backend-go/internal/platform/authjwt"
	"github.com/Maria3040/propfirm/backend-go/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

func (a *App) requireUser(r *http.Request) (*principal, error) {
	tok := authjwt.TokenFromRequest(r, a.Cfg)
	if tok == "" {
		return nil, errMsg("unauthorized")
	}
	claims, err := authjwt.Parse(a.Cfg, tok)
	if err != nil || claims.Subject == "" {
		return nil, errMsg("unauthorized")
	}
	return &principal{Sub: claims.Subject, Email: claims.Email, Role: claims.Role}, nil
}

func (a *App) requireAdmin(r *http.Request) (*principal, error) {
	u, err := a.requireUser(r)
	if err != nil {
		return nil, err
	}
	if u.Role != "Admin" {
		return nil, errMsg("forbidden")
	}
	return u, nil
}

func writeErr(w http.ResponseWriter, err error) {
	msg := err.Error()
	status := http.StatusBadRequest
	switch msg {
	case "unauthorized":
		status = http.StatusUnauthorized
	case "forbidden":
		status = http.StatusForbidden
	case "not found", "product not found", "account not found":
		status = http.StatusNotFound
	}
	httpx.WriteNestError(w, status, msg)
}

func (a *App) handleRoot(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, 200, map[string]any{
		"service": "PropFirm modular API (Go DDD modular monolith)",
		"orm":     "pgx",
		"docs":    "/ (see README)",
		"metrics": "/metrics",
	})
}

func (a *App) handleValidateCoupon(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code     string  `json:"code"`
		Subtotal float64 `json:"subtotal"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	c, ok := domain.LookupDemo(body.Code)
	if !ok {
		writeErr(w, errMsg("invalid coupon"))
		return
	}
	q, err := domain.Apply(c, body.Subtotal)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, 200, map[string]any{
		"valid": true,
		"code": q.Code, "kind": q.Kind, "value": q.Value,
		"discountAmount": q.DiscountAmount, "finalTotal": q.FinalTotal, "message": q.Message,
	})
}

func (a *App) handleRegister(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		DisplayName string `json:"displayName"`
		ClientIP    string `json:"clientIp"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	email := strings.TrimSpace(body.Email)
	if email == "" || body.Password == "" {
		writeErr(w, errMsg("email and password required"))
		return
	}
	display := body.DisplayName
	if display == "" {
		display = email
	}
	ctx := r.Context()
	var exists string
	err := a.DB.QueryRow(ctx, `SELECT id FROM users.traders WHERE LOWER(email)=LOWER($1)`, email).Scan(&exists)
	if err == nil {
		writeErr(w, errMsg("email already registered"))
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 10)
	if err != nil {
		writeErr(w, err)
		return
	}
	id := newID()
	now := time.Now().UTC()
	_, err = a.DB.Exec(ctx, `
		INSERT INTO users.traders (id, email, password_hash, display_name, role, created_at)
		VALUES ($1,$2,$3,$4,'Trader',$5)`, id, email, string(hash), display, now)
	if err != nil {
		writeErr(w, err)
		return
	}
	_ = a.Bus.Publish(evtUserRegistered, map[string]any{"userId": id, "email": email, "displayName": display, "role": "Trader"})
	_ = a.recordLogin(ctx, id, r, body.ClientIP)
	a.writeSession(w, id, email, display, "Trader")
}

func (a *App) handleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		ClientIP string `json:"clientIp"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	email := strings.TrimSpace(body.Email)
	var id, hash, display, role string
	err := a.DB.QueryRow(r.Context(), `
		SELECT id, password_hash, display_name, role FROM users.traders WHERE LOWER(email)=LOWER($1)`, email).
		Scan(&id, &hash, &display, &role)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)) != nil {
		writeErr(w, errMsg("unauthorized"))
		return
	}
	_ = a.recordLogin(r.Context(), id, r, body.ClientIP)
	a.writeSession(w, id, email, display, role)
}

func (a *App) writeSession(w http.ResponseWriter, id, email, display, role string) {
	tok, err := authjwt.Issue(a.Cfg, id, email, role, display)
	if err != nil {
		writeErr(w, err)
		return
	}
	authjwt.SetCookie(w, a.Cfg, tok)
	httpx.JSON(w, 200, map[string]any{
		"userId": id, "email": email, "displayName": display, "role": role,
	})
}

func (a *App) handleLogout(w http.ResponseWriter, r *http.Request) {
	authjwt.ClearCookie(w, a.Cfg)
	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (a *App) handleMe(w http.ResponseWriter, r *http.Request) {
	u, err := a.requireUser(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	var id, email, display, role string
	err = a.DB.QueryRow(r.Context(), `SELECT id, email, display_name, role FROM users.traders WHERE id=$1`, u.Sub).
		Scan(&id, &email, &display, &role)
	if err != nil {
		writeErr(w, errMsg("not found"))
		return
	}
	httpx.JSON(w, 200, map[string]any{"id": id, "email": email, "displayName": display, "role": role})
}

func (a *App) handleLoginHistory(w http.ResponseWriter, r *http.Request) {
	u, err := a.requireUser(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	rows, err := a.DB.Query(r.Context(), `
		SELECT id, ip, country, country_code, city, isp, org, connection_kind, connection_label, is_vpn, is_vps, user_agent, created_at
		FROM users.login_history WHERE trader_id=$1 ORDER BY created_at DESC LIMIT 50`, u.Sub)
	if err != nil {
		writeErr(w, err)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id string
		var ip, country, code, city, isp, org, kind, label, ua *string
		var vpn, vps *bool
		var created time.Time
		_ = rows.Scan(&id, &ip, &country, &code, &city, &isp, &org, &kind, &label, &vpn, &vps, &ua, &created)
		out = append(out, map[string]any{
			"id": id, "ip": ip, "country": country, "countryCode": code, "city": city, "isp": isp, "org": org,
			"connectionKind": kind, "connectionLabel": label, "isVpn": vpn, "isVps": vps, "userAgent": ua, "createdAt": created,
		})
	}
	httpx.JSON(w, 200, out)
}

func (a *App) recordLogin(ctx context.Context, traderID string, r *http.Request, clientIP string) error {
	ip := clientIP
	if ip == "" {
		ip = r.Header.Get("X-Forwarded-For")
		if ip == "" {
			ip = r.RemoteAddr
		}
	}
	ua := r.Header.Get("User-Agent")
	if len(ua) > 500 {
		ua = ua[:500]
	}
	_, err := a.DB.Exec(ctx, `
		INSERT INTO users.login_history (
			id, trader_id, ip, country, country_code, city, isp, org, connection_kind, connection_label, is_vpn, is_vps, user_agent, created_at
		) VALUES ($1,$2,$3,NULL,NULL,NULL,NULL,NULL,'unknown','Local / unknown',false,false,$4,$5)`,
		newID(), traderID, ip, nullStr(ua), time.Now().UTC())
	return err
}

func (a *App) handleListProducts(w http.ResponseWriter, r *http.Request) {
	q := `SELECT id, sku, name, description, phase_family, variant, variant_tagline, account_size, price, compare_price, phases,
		profit_target_pct, phase1_target_pct, phase2_target_pct, daily_loss_pct, max_loss_pct, min_trading_days,
		profit_split_pct, reward_cycle, avg_first_reward, is_most_popular
		FROM catalog.challenge_products WHERE is_active=true`
	args := []any{}
	if pf := r.URL.Query().Get("phaseFamily"); pf != "" {
		args = append(args, pf)
		q += ` AND phase_family=$` + strconv.Itoa(len(args))
	}
	if v := r.URL.Query().Get("variant"); v != "" {
		args = append(args, v)
		q += ` AND variant=$` + strconv.Itoa(len(args))
	}
	q += ` ORDER BY account_size ASC`
	rows, err := a.DB.Query(r.Context(), q, args...)
	if err != nil {
		writeErr(w, err)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var p productRow
		_ = rows.Scan(&p.ID, &p.SKU, &p.Name, &p.Description, &p.PhaseFamily, &p.Variant, &p.VariantTagline, &p.AccountSize, &p.Price, &p.ComparePrice, &p.Phases,
			&p.ProfitTargetPct, &p.Phase1TargetPct, &p.Phase2TargetPct, &p.DailyLossPct, &p.MaxLossPct, &p.MinTradingDays,
			&p.ProfitSplitPct, &p.RewardCycle, &p.AvgFirstReward, &p.IsMostPopular)
		out = append(out, p.DTO())
	}
	httpx.JSON(w, 200, out)
}

func (a *App) handleGetProduct(w http.ResponseWriter, r *http.Request) {
	p, err := a.getProduct(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, 200, p.DTO())
}

func (a *App) handleCreateOrder(w http.ResponseWriter, r *http.Request) {
	u, err := a.requireUser(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	var body struct {
		ProductID     string `json:"productId"`
		AddonSwapFree bool   `json:"addonSwapFree"`
		Platform      string `json:"platform"`
		Quantity      int    `json:"quantity"`
		CouponCode    string `json:"couponCode"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	var p productRow
	var active bool
	err = a.DB.QueryRow(r.Context(), `
		SELECT id, sku, name, description, phase_family, variant, variant_tagline, account_size, price, compare_price, phases,
			profit_target_pct, phase1_target_pct, phase2_target_pct, daily_loss_pct, max_loss_pct, min_trading_days,
			profit_split_pct, reward_cycle, avg_first_reward, is_most_popular, is_active
		FROM catalog.challenge_products WHERE id=$1`, body.ProductID).Scan(
		&p.ID, &p.SKU, &p.Name, &p.Description, &p.PhaseFamily, &p.Variant, &p.VariantTagline, &p.AccountSize, &p.Price, &p.ComparePrice, &p.Phases,
		&p.ProfitTargetPct, &p.Phase1TargetPct, &p.Phase2TargetPct, &p.DailyLossPct, &p.MaxLossPct, &p.MinTradingDays,
		&p.ProfitSplitPct, &p.RewardCycle, &p.AvgFirstReward, &p.IsMostPopular, &active)
	if err != nil || !active {
		writeErr(w, errMsg("product not found"))
		return
	}
	price, platform := domain.PriceOrder(p.Price, body.AddonSwapFree, body.Platform, body.Quantity)
	var couponApplied any
	if body.CouponCode != "" {
		c, ok := domain.LookupDemo(body.CouponCode)
		if !ok {
			writeErr(w, errMsg("invalid coupon"))
			return
		}
		q, qerr := domain.Apply(c, price)
		if qerr != nil {
			writeErr(w, qerr)
			return
		}
		price = q.FinalTotal
		couponApplied = q
	}
	intentID := "pi_" + newID()
	now := time.Now().UTC()
	_, err = a.DB.Exec(r.Context(), `
		INSERT INTO commerce.payment_intents (id, amount, status, created_at) VALUES ($1,$2,'requires_confirmation',$3)`,
		intentID, price, now)
	if err != nil {
		writeErr(w, err)
		return
	}
	p1 := p.Phase1TargetPct
	if p1 == 0 {
		p1 = p.ProfitTargetPct
	}
	orderID := newID()
	_, err = a.DB.Exec(r.Context(), `
		INSERT INTO commerce.orders (
			id, trader_id, product_id, sku, price, account_size, phases, profit_target_pct, phase1_target_pct, phase2_target_pct,
			daily_loss_pct, max_loss_pct, min_trading_days, addon_swap_free, platform, status, payment_intent_id, created_at, paid_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'RequiresConfirmation',$16,$17,NULL)`,
		orderID, u.Sub, p.ID, p.SKU, price, p.AccountSize, p.Phases, p1, p1, p.Phase2TargetPct,
		p.DailyLossPct, p.MaxLossPct, p.MinTradingDays, body.AddonSwapFree, platform, intentID, now)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, 200, map[string]any{
		"orderId": orderID, "status": "RequiresConfirmation", "price": price,
		"addonSwapFree": body.AddonSwapFree, "platform": platform, "paymentIntentId": intentID,
		"coupon": couponApplied,
		"nextPath": "/checkout/confirm/" + orderID,
	})
}

func (a *App) handleConfirmOrder(w http.ResponseWriter, r *http.Request) {
	u, err := a.requireUser(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	id := chi.URLParam(r, "id")
	o, err := a.getOrder(r.Context(), id)
	if err != nil || o.TraderID != u.Sub {
		writeErr(w, errMsg("not found"))
		return
	}
	if o.Status == "Paid" {
		var chID *string
		_ = a.DB.QueryRow(r.Context(), `SELECT id FROM challenges.challenge_instances WHERE order_id=$1`, id).Scan(&chID)
		httpx.JSON(w, 200, map[string]any{"orderId": id, "status": "Paid", "challengeId": chID, "alreadyPaid": true})
		return
	}
	if o.PaymentIntentID == nil {
		writeErr(w, errMsg("missing payment intent"))
		return
	}
	var st string
	err = a.DB.QueryRow(r.Context(), `SELECT status FROM commerce.payment_intents WHERE id=$1`, *o.PaymentIntentID).Scan(&st)
	if err != nil {
		writeErr(w, errMsg("payment intent not found"))
		return
	}
	if st == "succeeded" {
		// ok
	} else if st == "requires_confirmation" {
		now := time.Now().UTC()
		_, _ = a.DB.Exec(r.Context(), `UPDATE commerce.payment_intents SET status='succeeded', confirmed_at=$2 WHERE id=$1`, *o.PaymentIntentID, now)
	} else {
		writeErr(w, errMsg("payment not confirmable"))
		return
	}
	now := time.Now().UTC()
	_, err = a.DB.Exec(r.Context(), `UPDATE commerce.orders SET status='Paid', paid_at=$2 WHERE id=$1`, id, now)
	if err != nil {
		writeErr(w, err)
		return
	}
	o.Status = "Paid"
	o.PaidAt = &now
	if err := a.Bus.Publish(evtOrderPaid, orderPaidEvent{Order: o}); err != nil {
		writeErr(w, err)
		return
	}
	var chID *string
	_ = a.DB.QueryRow(r.Context(), `SELECT id FROM challenges.challenge_instances WHERE order_id=$1`, id).Scan(&chID)
	next := "/dashboard"
	if chID != nil {
		next = "/challenges/" + *chID
	}
	httpx.JSON(w, 200, map[string]any{"orderId": id, "status": "Paid", "challengeId": chID, "nextPath": next})
}

func (a *App) handleListChallenges(w http.ResponseWriter, r *http.Request) {
	u, err := a.requireUser(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	q := `SELECT id, trader_id, order_id, product_id, sku, account_size, phases, current_phase,
		profit_target_pct, phase1_target_pct, phase2_target_pct, daily_loss_pct, max_loss_pct, min_trading_days,
		status, fail_reason, created_at FROM challenges.challenge_instances`
	args := []any{}
	if u.Role != "Admin" {
		q += ` WHERE trader_id=$1`
		args = append(args, u.Sub)
	}
	q += ` ORDER BY created_at DESC`
	rows, err := a.DB.Query(r.Context(), q, args...)
	if err != nil {
		writeErr(w, err)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var c challengeRow
		_ = rows.Scan(&c.ID, &c.TraderID, &c.OrderID, &c.ProductID, &c.SKU, &c.AccountSize, &c.Phases, &c.CurrentPhase,
			&c.ProfitTargetPct, &c.Phase1TargetPct, &c.Phase2TargetPct, &c.DailyLossPct, &c.MaxLossPct, &c.MinTradingDays,
			&c.Status, &c.FailReason, &c.CreatedAt)
		m := c.Map()
		acc, aerr := a.getAccountByChallenge(r.Context(), c.ID)
		equity := c.AccountSize
		var login, platform any
		if aerr == nil {
			equity = acc.Equity
			login = acc.Login
			platform = acc.Platform
		}
		pnl := equity - c.AccountSize
		m["equity"] = equity
		m["pnl"] = pnl
		m["profitPct"] = (pnl / c.AccountSize) * 100
		m["login"] = login
		m["platform"] = platform
		out = append(out, m)
	}
	httpx.JSON(w, 200, out)
}

func (a *App) handleGetChallenge(w http.ResponseWriter, r *http.Request) {
	u, err := a.requireUser(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	c, err := a.getChallenge(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, err)
		return
	}
	if u.Role != "Admin" && c.TraderID != u.Sub {
		writeErr(w, errMsg("forbidden"))
		return
	}
	m := c.Map()
	acc, aerr := a.getAccountByChallenge(r.Context(), c.ID)
	var account any
	equity := c.AccountSize
	hwm := c.AccountSize
	if aerr == nil {
		equity = acc.Equity
		hwm = acc.HighWaterMark
		account = map[string]any{
			"id": acc.ID, "login": acc.Login, "password": acc.Password, "platform": acc.Platform, "server": acc.Server,
			"equity": acc.Equity, "startingBalance": acc.StartingBalance, "highWaterMark": acc.HighWaterMark, "locked": acc.Locked,
		}
	}
	rows, _ := a.DB.Query(r.Context(), `
		SELECT equity, day_pnl, trading_days, created_at FROM trading.equity_snapshots
		WHERE challenge_id=$1 ORDER BY created_at ASC LIMIT 60`, c.ID)
	series := []map[string]any{}
	var lastDays int
	var lastDayPnl float64
	maxEquity := equity
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var eq, dp float64
			var td int
			var t time.Time
			_ = rows.Scan(&eq, &dp, &td, &t)
			series = append(series, map[string]any{"t": t, "equity": eq, "dayPnl": dp})
			lastDays = td
			lastDayPnl = dp
			if eq > maxEquity {
				maxEquity = eq
			}
		}
	}
	if hwm > maxEquity {
		maxEquity = hwm
	}
	if c.AccountSize > maxEquity {
		maxEquity = c.AccountSize
	}
	targetPct := c.Phase1TargetPct
	if c.CurrentPhase > 1 {
		targetPct = c.Phase2TargetPct
	}
	if targetPct == 0 {
		targetPct = c.ProfitTargetPct
	}
	m["account"] = account
	m["progress"] = map[string]any{
		"equity": equity, "maxEquity": maxEquity, "targetEquity": c.AccountSize * (1 + targetPct/100),
		"targetPct": targetPct, "profitPct": ((equity - c.AccountSize) / c.AccountSize) * 100,
		"tradingDays": lastDays, "minTradingDays": c.MinTradingDays, "dayPnl": lastDayPnl,
	}
	m["equitySeries"] = series
	httpx.JSON(w, 200, m)
}

func (a *App) handleArchiveChallenge(w http.ResponseWriter, r *http.Request) {
	u, err := a.requireUser(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	c, err := a.getChallenge(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, err)
		return
	}
	if u.Role != "Admin" && c.TraderID != u.Sub {
		writeErr(w, errMsg("forbidden"))
		return
	}
	_, _ = a.DB.Exec(r.Context(), `UPDATE challenges.challenge_instances SET status='Closed' WHERE id=$1`, c.ID)
	_, _ = a.DB.Exec(r.Context(), `UPDATE trading.trading_accounts SET locked=true WHERE challenge_id=$1`, c.ID)
	httpx.JSON(w, 200, map[string]any{"ok": true, "id": c.ID, "status": "Closed"})
}

func (a *App) handleSimulateTrade(w http.ResponseWriter, r *http.Request) {
	u, err := a.requireUser(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	id := chi.URLParam(r, "id")
	c, err := a.getChallenge(r.Context(), id)
	if err != nil {
		writeErr(w, err)
		return
	}
	if u.Role != "Admin" && c.TraderID != u.Sub {
		writeErr(w, errMsg("forbidden"))
		return
	}
	var body struct {
		Symbol string  `json:"symbol"`
		Side   string  `json:"side"`
		Lots   float64 `json:"lots"`
		Pnl    float64 `json:"pnl"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	res, err := a.simulateTrade(r.Context(), id, body.Symbol, body.Side, body.Lots, body.Pnl)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, 200, res)
}

func (a *App) handleWallet(w http.ResponseWriter, r *http.Request) {
	u, err := a.requireUser(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	var bal float64
	err = a.DB.QueryRow(r.Context(), `SELECT available_balance FROM payouts.trader_wallets WHERE trader_id=$1`, u.Sub).Scan(&bal)
	if err != nil {
		bal = 0
	}
	httpx.JSON(w, 200, map[string]any{"traderId": u.Sub, "availableBalance": bal})
}

func (a *App) handleEligible(w http.ResponseWriter, r *http.Request) {
	u, err := a.requireUser(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	var bal float64
	_ = a.DB.QueryRow(r.Context(), `SELECT available_balance FROM payouts.trader_wallets WHERE trader_id=$1`, u.Sub).Scan(&bal)
	rows, err := a.DB.Query(r.Context(), `
		SELECT id, trader_id, order_id, product_id, sku, account_size, phases, current_phase,
			profit_target_pct, phase1_target_pct, phase2_target_pct, daily_loss_pct, max_loss_pct, min_trading_days,
			status, fail_reason, created_at
		FROM challenges.challenge_instances WHERE trader_id=$1 AND status='Funded' ORDER BY created_at DESC`, u.Sub)
	if err != nil {
		writeErr(w, err)
		return
	}
	defer rows.Close()
	accounts := []map[string]any{}
	for rows.Next() {
		var c challengeRow
		_ = rows.Scan(&c.ID, &c.TraderID, &c.OrderID, &c.ProductID, &c.SKU, &c.AccountSize, &c.Phases, &c.CurrentPhase,
			&c.ProfitTargetPct, &c.Phase1TargetPct, &c.Phase2TargetPct, &c.DailyLossPct, &c.MaxLossPct, &c.MinTradingDays,
			&c.Status, &c.FailReason, &c.CreatedAt)
		equity := c.AccountSize
		var login, platform any
		if acc, aerr := a.getAccountByChallenge(r.Context(), c.ID); aerr == nil {
			equity = acc.Equity
			login = acc.Login
			platform = acc.Platform
		}
		accounts = append(accounts, map[string]any{
			"id": c.ID, "sku": c.SKU, "status": c.Status, "accountSize": c.AccountSize,
			"equity": equity, "login": login, "platform": platform,
		})
	}
	httpx.JSON(w, 200, map[string]any{"availableBalance": bal, "accounts": accounts})
}

func (a *App) handleRequestPayout(w http.ResponseWriter, r *http.Request) {
	u, err := a.requireUser(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	var body struct {
		Amount         float64 `json:"amount"`
		ChallengeID    string  `json:"challengeId"`
		Method         string  `json:"method"`
		CryptoNetwork  string  `json:"cryptoNetwork"`
		CryptoAddress  string  `json:"cryptoAddress"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.Amount <= 0 {
		writeErr(w, errMsg("invalid amount"))
		return
	}
	method := strings.ToLower(body.Method)
	if method == "" {
		method = "crypto"
	}
	if method == "crypto" && (body.CryptoNetwork == "" || body.CryptoAddress == "") {
		writeErr(w, errMsg("cryptoNetwork and cryptoAddress required"))
		return
	}
	var bal float64
	_ = a.DB.QueryRow(r.Context(), `SELECT available_balance FROM payouts.trader_wallets WHERE trader_id=$1`, u.Sub).Scan(&bal)
	if body.Amount > bal {
		writeErr(w, errMsg("insufficient balance"))
		return
	}
	var challengeID any
	if body.ChallengeID != "" {
		c, err := a.getChallenge(r.Context(), body.ChallengeID)
		if err != nil || c.TraderID != u.Sub || c.Status != "Funded" {
			writeErr(w, errMsg("invalid challenge"))
			return
		}
		challengeID = body.ChallengeID
	}
	id := newID()
	now := time.Now().UTC()
	_, err = a.DB.Exec(r.Context(), `
		INSERT INTO payouts.payout_requests (
			id, trader_id, amount, status, challenge_id, method, reward_type, crypto_network, crypto_address, created_at, decided_at
		) VALUES ($1,$2,$3,'Pending',$4,$5,'Profit share',$6,$7,$8,NULL)`,
		id, u.Sub, body.Amount, challengeID, method, nullStr(body.CryptoNetwork), nullStr(body.CryptoAddress), now)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.JSON(w, 200, map[string]any{
		"id": id, "traderId": u.Sub, "amount": body.Amount, "status": "Pending", "challengeId": challengeID,
		"method": method, "rewardType": "Profit share", "cryptoNetwork": body.CryptoNetwork, "cryptoAddress": body.CryptoAddress,
		"createdAt": now, "decidedAt": nil,
	})
}

func (a *App) handleListPayouts(w http.ResponseWriter, r *http.Request) {
	u, err := a.requireUser(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	q := `SELECT id, trader_id, amount, status, challenge_id, method, reward_type, crypto_network, crypto_address, created_at, decided_at
		FROM payouts.payout_requests`
	args := []any{}
	if u.Role != "Admin" {
		q += ` WHERE trader_id=$1`
		args = append(args, u.Sub)
	}
	q += ` ORDER BY created_at DESC`
	rows, err := a.DB.Query(r.Context(), q, args...)
	if err != nil {
		writeErr(w, err)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, traderID, status string
		var amount float64
		var challengeID, method, rewardType, net, addr *string
		var created time.Time
		var decided *time.Time
		_ = rows.Scan(&id, &traderID, &amount, &status, &challengeID, &method, &rewardType, &net, &addr, &created, &decided)
		out = append(out, map[string]any{
			"id": id, "traderId": traderID, "amount": amount, "status": status, "challengeId": challengeID,
			"method": method, "rewardType": rewardType, "cryptoNetwork": net, "cryptoAddress": addr,
			"createdAt": created, "decidedAt": decided,
		})
	}
	httpx.JSON(w, 200, out)
}

func (a *App) handleDecidePayout(approve bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, err := a.requireAdmin(r); err != nil {
			writeErr(w, err)
			return
		}
		id := chi.URLParam(r, "id")
		var traderID, status string
		var amount float64
		err := a.DB.QueryRow(r.Context(), `SELECT trader_id, amount, status FROM payouts.payout_requests WHERE id=$1`, id).
			Scan(&traderID, &amount, &status)
		if err != nil {
			writeErr(w, errMsg("not found"))
			return
		}
		if status != "Pending" {
			writeErr(w, errMsg("already decided"))
			return
		}
		now := time.Now().UTC()
		if approve {
			var bal float64
			_ = a.DB.QueryRow(r.Context(), `SELECT available_balance FROM payouts.trader_wallets WHERE trader_id=$1`, traderID).Scan(&bal)
			if amount > bal {
				writeErr(w, errMsg("insufficient balance"))
				return
			}
			_, _ = a.DB.Exec(r.Context(), `UPDATE payouts.trader_wallets SET available_balance=$2, updated_at=$3 WHERE trader_id=$1`, traderID, bal-amount, now)
			_, _ = a.DB.Exec(r.Context(), `UPDATE payouts.payout_requests SET status='Approved', decided_at=$2 WHERE id=$1`, id, now)
			_ = a.Bus.Publish(evtPayoutCompleted, map[string]any{"traderId": traderID, "payoutId": id, "amount": amount})
			status = "Approved"
		} else {
			_, _ = a.DB.Exec(r.Context(), `UPDATE payouts.payout_requests SET status='Rejected', decided_at=$2 WHERE id=$1`, id, now)
			status = "Rejected"
		}
		httpx.JSON(w, 200, map[string]any{"id": id, "traderId": traderID, "amount": amount, "status": status, "decidedAt": now})
	}
}

func (a *App) handleAudit(w http.ResponseWriter, r *http.Request) {
	if _, err := a.requireAdmin(r); err != nil {
		writeErr(w, err)
		return
	}
	limit := 50
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	rows, err := a.DB.Query(r.Context(), `
		SELECT id, event_type, source, summary, payload_json, occurred_at
		FROM audithub.audit_entries ORDER BY occurred_at DESC LIMIT $1`, limit)
	if err != nil {
		writeErr(w, err)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, et, src, summary string
		var payload *string
		var at time.Time
		_ = rows.Scan(&id, &et, &src, &summary, &payload, &at)
		out = append(out, map[string]any{
			"id": id, "eventType": et, "source": src, "summary": summary, "payloadJson": payload, "occurredAt": at,
		})
	}
	httpx.JSON(w, 200, out)
}

func (a *App) handleJoinedCompetitions(w http.ResponseWriter, r *http.Request) {
	u, err := a.requireUser(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	rows, err := a.DB.Query(r.Context(), `SELECT competition_id FROM competitions.competition_joins WHERE trader_id=$1`, u.Sub)
	if err != nil {
		writeErr(w, err)
		return
	}
	defer rows.Close()
	ids := []string{}
	for rows.Next() {
		var id string
		_ = rows.Scan(&id)
		ids = append(ids, id)
	}
	httpx.JSON(w, 200, map[string]any{"competitionIds": ids})
}

func (a *App) handleJoinCompetition(w http.ResponseWriter, r *http.Request) {
	u, err := a.requireUser(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	compID := chi.URLParam(r, "id")
	var body struct {
		Title string `json:"title"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	var existing string
	err = a.DB.QueryRow(r.Context(), `
		SELECT id FROM competitions.competition_joins WHERE trader_id=$1 AND competition_id=$2`, u.Sub, compID).Scan(&existing)
	if err == nil {
		httpx.JSON(w, 200, map[string]any{"joined": true, "alreadyJoined": true, "emailSent": false})
		return
	}
	if !errorsIsNoRows(err) {
		writeErr(w, err)
		return
	}
	_, err = a.DB.Exec(r.Context(), `
		INSERT INTO competitions.competition_joins (id, trader_id, competition_id, competition_title, created_at)
		VALUES ($1,$2,$3,$4,$5)`, newID(), u.Sub, compID, body.Title, time.Now().UTC())
	if err != nil {
		writeErr(w, err)
		return
	}
	_ = a.Bus.Publish(evtCompetitionJoined, map[string]any{"traderId": u.Sub, "competitionId": compID, "title": body.Title})
	httpx.JSON(w, 200, map[string]any{"joined": true, "alreadyJoined": false, "emailSent": true})
}

func (a *App) handleNotifications(w http.ResponseWriter, r *http.Request) {
	u, err := a.requireUser(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	email := a.traderEmail(r.Context(), u.Sub)
	rows, err := a.DB.Query(r.Context(), `
		SELECT id, to_email, subject, body, status, delivery_detail, created_at
		FROM notifications.notification_messages WHERE to_email=$1 ORDER BY created_at DESC LIMIT 50`, email)
	if err != nil {
		writeErr(w, err)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, to, subject, body, status string
		var detail *string
		var created time.Time
		_ = rows.Scan(&id, &to, &subject, &body, &status, &detail, &created)
		out = append(out, map[string]any{
			"id": id, "toEmail": to, "subject": subject, "body": body, "status": status, "deliveryDetail": detail, "createdAt": created,
		})
	}
	httpx.JSON(w, 200, out)
}

func errorsIsNoRows(err error) bool {
	return err != nil && (err.Error() == "no rows in result set" || err == pgx.ErrNoRows)
}
