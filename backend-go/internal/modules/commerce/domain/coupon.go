package domain

import (
	"fmt"
	"math"
	"strings"

	"github.com/Maria3040/propfirm/backend-go/internal/sharedkernel"
)

type Kind string

const (
	KindPercent Kind = "percent"
	KindFlat    Kind = "flat"
)

// Coupon is a pure value object for checkout discounts.
type Coupon struct {
	Code        string
	Kind        Kind
	Value       float64 // percent (0-100) or flat USD
	MinSubtotal float64
	Active      bool
}

type Quote struct {
	Code           string  `json:"code"`
	Kind           Kind    `json:"kind"`
	Value          float64 `json:"value"`
	DiscountAmount float64 `json:"discountAmount"`
	FinalTotal     float64 `json:"finalTotal"`
	Message        string  `json:"message"`
}

func NormalizeCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

// Apply computes discount for a cart/order subtotal.
func Apply(c Coupon, subtotal float64) (Quote, error) {
	code := NormalizeCode(c.Code)
	if code == "" {
		return Quote{}, sharedkernel.NewDomainError("coupon code required")
	}
	if !c.Active {
		return Quote{}, sharedkernel.NewDomainError("coupon is not active")
	}
	if subtotal < 0 {
		return Quote{}, sharedkernel.NewDomainError("invalid subtotal")
	}
	if subtotal < c.MinSubtotal {
		return Quote{}, sharedkernel.Errf("minimum subtotal for this coupon is %.2f", c.MinSubtotal)
	}

	var discount float64
	switch c.Kind {
	case KindPercent:
		if c.Value <= 0 || c.Value > 100 {
			return Quote{}, sharedkernel.NewDomainError("invalid percent coupon")
		}
		discount = round2(subtotal * (c.Value / 100))
	case KindFlat:
		if c.Value <= 0 {
			return Quote{}, sharedkernel.NewDomainError("invalid flat coupon")
		}
		discount = c.Value
		if discount > subtotal {
			discount = subtotal
		}
		discount = round2(discount)
	default:
		return Quote{}, sharedkernel.NewDomainError("unknown coupon kind")
	}

	final := round2(subtotal - discount)
	if final < 0 {
		final = 0
	}

	msg := fmt.Sprintf("Coupon applied: %.0f%% off", c.Value)
	if c.Kind == KindFlat {
		msg = fmt.Sprintf("Coupon applied: $%.2f off", c.Value)
	} else if c.Value != float64(int(c.Value)) {
		msg = fmt.Sprintf("Coupon applied: %.2f%% off", c.Value)
	}

	return Quote{
		Code: code, Kind: c.Kind, Value: c.Value,
		DiscountAmount: discount, FinalTotal: final, Message: msg,
	}, nil
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}
