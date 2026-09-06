package app

import (
	"context"
	"time"

	"github.com/Maria3040/propfirm/backend-go/internal/platform/bus"
	"github.com/Maria3040/propfirm/backend-go/internal/platform/config"
	"github.com/Maria3040/propfirm/backend-go/internal/platform/mail"
	"github.com/jackc/pgx/v5/pgxpool"
)

type App struct {
	Cfg  config.Settings
	DB   *pgxpool.Pool
	Bus  *bus.Bus
	Mail mail.Sender
}

func New(cfg config.Settings, db *pgxpool.Pool) *App {
	a := &App{
		Cfg:  cfg,
		DB:   db,
		Bus:  bus.New(),
		Mail: mail.Sender{Host: cfg.SMTPHost, Port: cfg.SMTPPort, From: cfg.SMTPFrom},
	}
	a.wireBus()
	return a
}

func (a *App) notify(ctx context.Context, to, subject, body string) {
	status := "Sent"
	detail := ""
	if err := a.Mail.Send(to, subject, body); err != nil {
		status = "Failed"
		detail = err.Error()
	}
	_, _ = a.DB.Exec(ctx, `
		INSERT INTO notifications.notification_messages (id, to_email, subject, body, status, delivery_detail, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		newID(), to, subject, body, status, nullStr(detail), time.Now().UTC())
}

func (a *App) audit(ctx context.Context, eventType, source, summary string, payload any) {
	_, _ = a.DB.Exec(ctx, `
		INSERT INTO audithub.audit_entries (id, event_type, source, summary, payload_json, occurred_at)
		VALUES ($1,$2,$3,$4,$5,$6)`,
		newID(), eventType, source, summary, mustJSON(payload), time.Now().UTC())
}

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}
