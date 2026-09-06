//go:build integration

package integration_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/Maria3040/propfirm/backend-go/internal/app"
	"github.com/Maria3040/propfirm/backend-go/internal/platform/config"
	"github.com/Maria3040/propfirm/backend-go/internal/platform/db"
	"github.com/Maria3040/propfirm/backend-go/migrations"
)

type client struct {
	t      *testing.T
	base   string
	http   *http.Client
}

func startApp(t *testing.T) *client {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		url = "postgresql://propfirm:propfirm_dev@127.0.0.1:15433/propfirm"
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, url)
	if err != nil {
		t.Skipf("postgres unavailable: %v", err)
	}
	t.Cleanup(pool.Close)
	if err := db.MigrateSQL(ctx, pool, migrations.InitSQL); err != nil {
		t.Fatal(err)
	}
	cfg := config.Load()
	application := app.New(cfg, pool)
	if err := application.Seed(ctx); err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(application.Router())
	t.Cleanup(srv.Close)
	jar, _ := cookiejar.New(nil)
	return &client{t: t, base: srv.URL, http: &http.Client{Jar: jar, Timeout: 15 * time.Second}}
}

func (c *client) do(method, path string, body any) (int, map[string]any, []byte) {
	c.t.Helper()
	var rdr io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, c.base+path, rdr)
	if err != nil {
		c.t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := c.http.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	var obj map[string]any
	_ = json.Unmarshal(raw, &obj)
	return res.StatusCode, obj, raw
}

func (c *client) login(email, password string) {
	c.t.Helper()
	st, _, raw := c.do("POST", "/api/auth/login", map[string]string{"email": email, "password": password})
	if st != 200 {
		c.t.Fatalf("login %d %s", st, raw)
	}
}

func TestRootAndMetrics(t *testing.T) {
	c := startApp(t)
	st, obj, _ := c.do("GET", "/", nil)
	if st != 200 || obj["orm"] != "pgx" {
		t.Fatalf("root %+v", obj)
	}
	st, _, _ = c.do("GET", "/metrics", nil)
	if st != 200 {
		t.Fatalf("metrics %d", st)
	}
}

func TestAuthEdges(t *testing.T) {
	c := startApp(t)
	st, _, _ := c.do("POST", "/api/auth/login", map[string]string{"email": "nope@x.com", "password": "bad"})
	if st != 401 {
		t.Fatalf("bad login %d", st)
	}
	st, _, _ = c.do("GET", "/api/users/me", nil)
	if st != 401 {
		t.Fatalf("me unauth %d", st)
	}
	email := fmt.Sprintf("edge-%d@propfirm.local", time.Now().UnixNano())
	st, sess, raw := c.do("POST", "/api/auth/register", map[string]string{
		"email": email, "password": "EdgeTest1!", "displayName": "Edge",
	})
	if st != 200 {
		t.Fatalf("register %d %s", st, raw)
	}
	if sess["userId"] == nil {
		t.Fatal("missing userId")
	}
	st, _, raw = c.do("POST", "/api/auth/register", map[string]string{"email": email, "password": "EdgeTest1!"})
	if st != 400 {
		t.Fatalf("dup register %d %s", st, raw)
	}
	st, me, _ := c.do("GET", "/api/users/me", nil)
	if st != 200 || me["email"] != email {
		t.Fatalf("me %+v", me)
	}
	st, _, _ = c.do("GET", "/api/users/me/login-history", nil)
	if st != 200 {
		t.Fatalf("history %d", st)
	}
	st, _, _ = c.do("POST", "/api/auth/logout", nil)
	if st != 200 {
		t.Fatalf("logout %d", st)
	}
}

func TestCouponValidateEdges(t *testing.T) {
	c := startApp(t)
	st, q, raw := c.do("POST", "/api/coupons/validate", map[string]any{"code": "WELCOME10", "subtotal": 100})
	if st != 200 || q["finalTotal"].(float64) != 90 {
		t.Fatalf("welcome %d %s", st, raw)
	}
	st, _, _ = c.do("POST", "/api/coupons/validate", map[string]any{"code": "EXPIRED", "subtotal": 100})
	if st != 400 {
		t.Fatalf("expired %d", st)
	}
	st, _, _ = c.do("POST", "/api/coupons/validate", map[string]any{"code": "NOPE", "subtotal": 100})
	if st != 400 {
		t.Fatalf("invalid %d", st)
	}
	st, _, _ = c.do("POST", "/api/coupons/validate", map[string]any{"code": "FLAT50", "subtotal": 30})
	if st != 400 {
		t.Fatalf("min subtotal %d", st)
	}
	st, q, _ = c.do("POST", "/api/coupons/validate", map[string]any{"code": "FLAT50", "subtotal": 80})
	if st != 200 || q["finalTotal"].(float64) != 30 {
		t.Fatalf("flat %+v", q)
	}
}

func TestCatalogOrdersChallengesPayoutsCompetitions(t *testing.T) {
	c := startApp(t)
	c.login("trader@propfirm.local", "Trader1!")

	st, _, raw := c.do("GET", "/api/catalog/products", nil)
	if st != 200 {
		t.Fatalf("products %d %s", st, raw)
	}
	var products []map[string]any
	_ = json.Unmarshal(raw, &products)
	if len(products) < 25 {
		t.Fatalf("catalog size %d", len(products))
	}
	pid := products[0]["id"].(string)

	st, _, _ = c.do("GET", "/api/catalog/products/"+pid, nil)
	if st != 200 {
		t.Fatalf("product %d", st)
	}

	st, order, raw := c.do("POST", "/api/orders", map[string]any{
		"productId": pid, "platform": "mt5", "quantity": 1, "couponCode": "WELCOME10",
	})
	if st != 200 {
		t.Fatalf("order %d %s", st, raw)
	}
	orderID := order["orderId"].(string)
	if order["coupon"] == nil {
		t.Fatal("expected coupon on order")
	}

	st, paid, raw := c.do("POST", "/api/orders/"+orderID+"/confirm", nil)
	if st != 200 {
		t.Fatalf("confirm %d %s", st, raw)
	}
	cid, _ := paid["challengeId"].(string)
	if cid == "" {
		t.Fatal("no challengeId")
	}

	st, _, _ = c.do("GET", "/api/challenges", nil)
	if st != 200 {
		t.Fatalf("challenges %d", st)
	}
	st, detail, _ := c.do("GET", "/api/challenges/"+cid, nil)
	if st != 200 || detail["account"] == nil {
		t.Fatalf("detail %+v", detail)
	}
	st, sim, raw := c.do("POST", "/api/challenges/"+cid+"/trades/simulate", map[string]any{"pnl": 25})
	if st != 200 {
		t.Fatalf("simulate %d %s", st, raw)
	}
	if sim["equity"] == nil {
		t.Fatal("equity missing")
	}

	st, wallet, _ := c.do("GET", "/api/payouts/wallet", nil)
	if st != 200 {
		t.Fatalf("wallet %d", st)
	}
	_ = wallet
	st, elig, raw := c.do("GET", "/api/payouts/eligible", nil)
	if st != 200 {
		t.Fatalf("eligible %d %s", st, raw)
	}
	accounts, _ := elig["accounts"].([]any)
	if len(accounts) == 0 {
		t.Fatal("expected funded demo account in eligible")
	}
	acc0 := accounts[0].(map[string]any)
	if acc0["equity"] == nil {
		t.Fatalf("eligible equity missing: %+v", acc0)
	}

	fundedID := acc0["id"].(string)
	st, _, raw = c.do("POST", "/api/payouts/request", map[string]any{
		"amount": 10, "challengeId": fundedID, "method": "crypto",
		"cryptoNetwork": "USDT TRC20", "cryptoAddress": "TTESTADDRESS",
	})
	if st != 200 {
		t.Fatalf("payout request %d %s", st, raw)
	}
	st, _, _ = c.do("GET", "/api/payouts", nil)
	if st != 200 {
		t.Fatalf("payouts %d", st)
	}

	st, joined, _ := c.do("GET", "/api/competitions/joined", nil)
	if st != 200 {
		t.Fatalf("joined %d", st)
	}
	_ = joined
	st, j, raw := c.do("POST", "/api/competitions/demo-comp/join", map[string]any{"title": "Demo Cup"})
	if st != 200 {
		t.Fatalf("join %d %s", st, raw)
	}
	if j["joined"] != true {
		t.Fatalf("join %+v", j)
	}
	st, j2, _ := c.do("POST", "/api/competitions/demo-comp/join", map[string]any{"title": "Demo Cup"})
	if st != 200 || j2["alreadyJoined"] != true {
		t.Fatalf("rejoin %+v", j2)
	}

	st, _, _ = c.do("GET", "/api/notifications", nil)
	if st != 200 {
		t.Fatalf("notifications %d", st)
	}

	// admin endpoints
	c2 := startApp(t)
	c2.login("admin@propfirm.local", "Admin1!")
	st, _, _ = c2.do("GET", "/api/admin/audit", nil)
	if st != 200 {
		t.Fatalf("audit %d", st)
	}
	st, list, raw := c2.do("GET", "/api/payouts", nil)
	if st != 200 {
		t.Fatalf("admin payouts %d %s", st, raw)
	}
	_ = list
}
