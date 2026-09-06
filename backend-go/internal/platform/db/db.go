package db

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}

func MigrateSQL(ctx context.Context, pool *pgxpool.Pool, sql string) error {
	for _, stmt := range splitSQL(sql) {
		if _, err := pool.Exec(ctx, stmt); err != nil {
			preview := stmt
			if len(preview) > 100 {
				preview = preview[:100]
			}
			return fmt.Errorf("migrate: %w (%s)", err, preview)
		}
	}
	return nil
}

func splitSQL(sql string) []string {
	parts := strings.Split(sql, ";")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		t := strings.TrimSpace(p)
		if t != "" {
			out = append(out, t)
		}
	}
	return out
}
