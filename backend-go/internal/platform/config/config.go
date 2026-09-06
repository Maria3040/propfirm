package config

import (
	"os"
	"strconv"
	"strings"
)

type Settings struct {
	HTTPPort       int
	DatabaseURL    string
	JWTKey         string
	JWTIssuer      string
	JWTAudience    string
	CORSOrigins    []string
	AuthCookieName string
	SMTPHost       string
	SMTPPort       int
	SMTPFrom       string
	Production     bool
}

func Load() Settings {
	cors := env("CORS_ORIGIN", "http://localhost:3100,http://127.0.0.1:3100")
	origins := strings.Split(cors, ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}
	return Settings{
		HTTPPort:       envInt("HTTP_PORT", 6080),
		DatabaseURL:    env("DATABASE_URL", "postgresql://propfirm:propfirm_dev@127.0.0.1:15433/propfirm"),
		JWTKey:         env("JWT_KEY", "propfirm-dev-signing-key-32chars!!"),
		JWTIssuer:      env("JWT_ISSUER", "propfirm"),
		JWTAudience:    env("JWT_AUDIENCE", "propfirm-clients"),
		CORSOrigins:    origins,
		AuthCookieName: env("AUTH_COOKIE_NAME", "propfirm_access"),
		SMTPHost:       env("SMTP_HOST", "127.0.0.1"),
		SMTPPort:       envInt("SMTP_PORT", 2525),
		SMTPFrom:       env("SMTP_FROM", "noreply@propfirm.local"),
		Production:     os.Getenv("ENV") == "production" || os.Getenv("NODE_ENV") == "production",
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func envInt(k string, def int) int {
	if v := os.Getenv(k); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
