package domain

// Catalog of demo coupons (also seeded conceptually for API lookup).
func DemoCoupons() map[string]Coupon {
	return map[string]Coupon{
		"WELCOME10": {Code: "WELCOME10", Kind: KindPercent, Value: 10, Active: true},
		"SAVE20":    {Code: "SAVE20", Kind: KindPercent, Value: 20, Active: true},
		"FLAT50":    {Code: "FLAT50", Kind: KindFlat, Value: 50, MinSubtotal: 50, Active: true},
		"FREEPASS":  {Code: "FREEPASS", Kind: KindPercent, Value: 100, Active: true},
		"EXPIRED":   {Code: "EXPIRED", Kind: KindPercent, Value: 15, Active: false},
	}
}

func LookupDemo(code string) (Coupon, bool) {
	c, ok := DemoCoupons()[NormalizeCode(code)]
	return c, ok
}
