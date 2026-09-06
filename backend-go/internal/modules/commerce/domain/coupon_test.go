package domain

import "testing"

func TestApplyPercent(t *testing.T) {
	q, err := Apply(Coupon{Code: "welcome10", Kind: KindPercent, Value: 10, Active: true}, 100)
	if err != nil {
		t.Fatal(err)
	}
	if q.Code != "WELCOME10" || q.DiscountAmount != 10 || q.FinalTotal != 90 {
		t.Fatalf("%+v", q)
	}
}

func TestApplyFlatCapsAtSubtotal(t *testing.T) {
	q, err := Apply(Coupon{Code: "FLAT50", Kind: KindFlat, Value: 50, Active: true}, 30)
	if err != nil {
		t.Fatal(err)
	}
	if q.DiscountAmount != 30 || q.FinalTotal != 0 {
		t.Fatalf("%+v", q)
	}
}

func TestApplyInactive(t *testing.T) {
	_, err := Apply(Coupon{Code: "DEAD", Kind: KindPercent, Value: 10, Active: false}, 100)
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestApplyMinSubtotal(t *testing.T) {
	_, err := Apply(Coupon{Code: "BIG", Kind: KindPercent, Value: 20, MinSubtotal: 200, Active: true}, 100)
	if err == nil {
		t.Fatal("expected min subtotal error")
	}
}

func TestApplyEmptyCode(t *testing.T) {
	_, err := Apply(Coupon{Code: "  ", Kind: KindPercent, Value: 10, Active: true}, 100)
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestApplyInvalidPercent(t *testing.T) {
	_, err := Apply(Coupon{Code: "X", Kind: KindPercent, Value: 0, Active: true}, 100)
	if err == nil {
		t.Fatal("expected error")
	}
	_, err = Apply(Coupon{Code: "X", Kind: KindPercent, Value: 150, Active: true}, 100)
	if err == nil {
		t.Fatal("expected error")
	}
}
