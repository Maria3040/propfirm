package app

import (
	"net/http"

	"github.com/Maria3040/propfirm/backend-go/internal/platform/httpx"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func (a *App) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, middleware.Logger, middleware.Recoverer)
	r.Use(httpx.CORS(a.Cfg.CORSOrigins))

	r.Get("/", a.handleRoot)
	r.Handle("/metrics", promhttp.Handler())

	r.Post("/api/auth/register", a.handleRegister)
	r.Post("/api/auth/login", a.handleLogin)
	r.Post("/api/auth/logout", a.handleLogout)
	r.Get("/api/users/me", a.handleMe)
	r.Get("/api/users/me/login-history", a.handleLoginHistory)

	r.Get("/api/catalog/products", a.handleListProducts)
	r.Get("/api/catalog/products/{id}", a.handleGetProduct)
	r.Post("/api/coupons/validate", a.handleValidateCoupon)

	r.Post("/api/orders", a.handleCreateOrder)
	r.Post("/api/orders/{id}/confirm", a.handleConfirmOrder)

	r.Get("/api/challenges", a.handleListChallenges)
	r.Get("/api/challenges/{id}", a.handleGetChallenge)
	r.Post("/api/challenges/{id}/archive", a.handleArchiveChallenge)
	r.Post("/api/challenges/{id}/trades/simulate", a.handleSimulateTrade)

	r.Get("/api/payouts/wallet", a.handleWallet)
	r.Get("/api/payouts/eligible", a.handleEligible)
	r.Post("/api/payouts/request", a.handleRequestPayout)
	r.Get("/api/payouts", a.handleListPayouts)
	r.Post("/api/admin/payouts/{id}/approve", a.handleDecidePayout(true))
	r.Post("/api/admin/payouts/{id}/reject", a.handleDecidePayout(false))
	r.Get("/api/admin/audit", a.handleAudit)

	r.Get("/api/competitions/joined", a.handleJoinedCompetitions)
	r.Post("/api/competitions/{id}/join", a.handleJoinCompetition)
	r.Get("/api/notifications", a.handleNotifications)

	return r
}
