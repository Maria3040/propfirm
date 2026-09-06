package authjwt

import (
	"net/http"
	"time"

	"github.com/Maria3040/propfirm/backend-go/internal/platform/config"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	Email       string `json:"email"`
	Role        string `json:"role"`
	DisplayName string `json:"display_name"`
	jwt.RegisteredClaims
}

func Issue(cfg config.Settings, sub, email, role, displayName string) (string, error) {
	claims := Claims{
		Email:       email,
		Role:        role,
		DisplayName: displayName,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   sub,
			Issuer:    cfg.JWTIssuer,
			Audience:  []string{cfg.JWTAudience},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(8 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString([]byte(cfg.JWTKey))
}

func Parse(cfg config.Settings, token string) (*Claims, error) {
	parsed, err := jwt.ParseWithClaims(token, &Claims{}, func(t *jwt.Token) (any, error) {
		return []byte(cfg.JWTKey), nil
	}, jwt.WithAudience(cfg.JWTAudience), jwt.WithIssuer(cfg.JWTIssuer))
	if err != nil {
		return nil, err
	}
	c, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return nil, jwt.ErrTokenInvalidClaims
	}
	return c, nil
}

func SetCookie(w http.ResponseWriter, cfg config.Settings, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     cfg.AuthCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   8 * 60 * 60,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   cfg.Production,
	})
}

func ClearCookie(w http.ResponseWriter, cfg config.Settings) {
	http.SetCookie(w, &http.Cookie{
		Name:     cfg.AuthCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   cfg.Production,
	})
}

func TokenFromRequest(r *http.Request, cfg config.Settings) string {
	if auth := r.Header.Get("Authorization"); len(auth) > 7 && (auth[:7] == "Bearer " || auth[:7] == "bearer ") {
		return auth[7:]
	}
	if c, err := r.Cookie(cfg.AuthCookieName); err == nil {
		return c.Value
	}
	return ""
}
