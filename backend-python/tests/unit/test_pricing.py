from app.modules.commerce.domain.pricing import apply_coupon, lookup_coupon, price_order
from app.shared_kernel.errors import DomainError
import pytest


def test_welcome10_percent():
    quote = apply_coupon(lookup_coupon("welcome10"), 100)
    assert quote.discount_amount == 10
    assert quote.final_total == 90


def test_expired_coupon_rejected():
    coupon = lookup_coupon("EXPIRED")
    assert coupon is not None
    with pytest.raises(DomainError, match="not active"):
        apply_coupon(coupon, 100)


def test_price_order_swap_and_ctrader():
    price, platform = price_order(100, True, "ctrader", 1)
    assert platform == "ctrader"
    assert price == 130.0  # 100*1.1 + 20
