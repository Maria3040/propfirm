package domain

import "testing"

func TestPriceOrderSwapAndCTrader(t *testing.T) {
	price, plat := PriceOrder(100, true, "ctrader", 2)
	if plat != "ctrader" {
		t.Fatalf("platform %s", plat)
	}
	// unit = 100*1.1 + 20 = 130; *2 = 260
	if price != 260 {
		t.Fatalf("price %v", price)
	}
}

func TestPriceOrderClampQty(t *testing.T) {
	price, _ := PriceOrder(10, false, "mt5", 0)
	if price != 10 {
		t.Fatalf("got %v", price)
	}
	price, _ = PriceOrder(10, false, "mt5", 99)
	if price != 100 {
		t.Fatalf("got %v", price)
	}
}
