from __future__ import annotations

from dataclasses import dataclass

from app.shared_kernel.errors import DomainError


@dataclass(frozen=True)
class Coupon:
    code: str
    kind: str  # percent | flat
    value: float
    min_subtotal: float = 0
    active: bool = True


@dataclass(frozen=True)
class CouponQuote:
    code: str
    kind: str
    value: float
    discount_amount: float
    final_total: float
    message: str


def normalize_code(code: str) -> str:
    return (code or "").strip().upper()


DEMO_COUPONS: dict[str, Coupon] = {
    "WELCOME10": Coupon("WELCOME10", "percent", 10),
    "SAVE20": Coupon("SAVE20", "percent", 20),
    "FLAT50": Coupon("FLAT50", "flat", 50, min_subtotal=50),
    "FREEPASS": Coupon("FREEPASS", "percent", 100),
    "EXPIRED": Coupon("EXPIRED", "percent", 15, active=False),
}


def lookup_coupon(code: str) -> Coupon | None:
    return DEMO_COUPONS.get(normalize_code(code))


def apply_coupon(coupon: Coupon, subtotal: float) -> CouponQuote:
    code = normalize_code(coupon.code)
    if not code:
        raise DomainError("coupon code required")
    if not coupon.active:
        raise DomainError("coupon is not active")
    if subtotal < 0:
        raise DomainError("invalid subtotal")
    if subtotal < coupon.min_subtotal:
        raise DomainError(f"minimum subtotal for this coupon is {coupon.min_subtotal:.2f}")

    if coupon.kind == "percent":
        if coupon.value <= 0 or coupon.value > 100:
            raise DomainError("invalid percent coupon")
        discount = round(subtotal * (coupon.value / 100), 2)
        message = f"Coupon applied: {coupon.value:g}% off"
    elif coupon.kind == "flat":
        if coupon.value <= 0:
            raise DomainError("invalid flat coupon")
        discount = round(min(coupon.value, subtotal), 2)
        message = f"Coupon applied: ${coupon.value:.2f} off"
    else:
        raise DomainError("unknown coupon kind")

    final = round(max(0.0, subtotal - discount), 2)
    return CouponQuote(code, coupon.kind, coupon.value, discount, final, message)


def price_order(product_price: float, addon_swap_free: bool, platform: str, quantity: int) -> tuple[float, str]:
    p = (platform or "mt5").lower()
    if p not in {"mt5", "matchtrader", "ctrader"}:
        p = "mt5"
    fee = 20.0 if p == "ctrader" else 0.0
    q = min(10, max(1, int(quantity or 1)))
    mult = 1.1 if addon_swap_free else 1.0
    unit = product_price * mult + fee
    return round(unit * q, 2), p
