package domain

import (
	"math"
	"strings"
)

// PriceOrder mirrors Nest POST /api/orders pricing.
func PriceOrder(productPrice float64, addonSwapFree bool, platform string, quantity int) (price float64, normalizedPlatform string) {
	p := strings.ToLower(platform)
	if p != "mt5" && p != "matchtrader" && p != "ctrader" {
		p = "mt5"
	}
	fee := 0.0
	if p == "ctrader" {
		fee = 20
	}
	q := quantity
	if q < 1 {
		q = 1
	}
	if q > 10 {
		q = 10
	}
	mult := 1.0
	if addonSwapFree {
		mult = 1.1
	}
	unit := productPrice*mult + fee
	price = math.Round(unit*float64(q)*100) / 100
	return price, p
}
