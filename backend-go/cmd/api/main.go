package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Maria3040/propfirm/backend-go/internal/app"
	"github.com/Maria3040/propfirm/backend-go/internal/platform/config"
	"github.com/Maria3040/propfirm/backend-go/internal/platform/db"
	"github.com/Maria3040/propfirm/backend-go/migrations"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	if err := db.MigrateSQL(ctx, pool, migrations.InitSQL); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	application := app.New(cfg, pool)
	if err := application.Seed(ctx); err != nil {
		log.Fatalf("seed: %v", err)
	}

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.HTTPPort),
		Handler:           application.Router(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("PropFirm Go API listening on :%d", cfg.HTTPPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}
