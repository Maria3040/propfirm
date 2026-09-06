"""Admin domain-adjacent edge cases via application service helpers (pure math already covered elsewhere)."""

from app.modules.payouts.domain.profit_share import profit_share_cap, remaining_withdrawable
from app.modules.risk.domain.risk import RiskInput, evaluate_risk
from app.modules.commerce.domain.pricing import apply_coupon, lookup_coupon
from app.modules.challenges.domain.challenge import mark_phase_passed
from app.shared_kernel.errors import DomainError
import pytest


def test_profit_share_exact_boundary_zero_profit():
    assert profit_share_cap(100_000, 100_000, 80) == 0
    assert remaining_withdrawable(0, 0) == 0


def test_profit_share_split_clamped():
    # >100% treated as 100
    assert profit_share_cap(110_000, 100_000, 150) == 10_000
    assert profit_share_cap(110_000, 100_000, -10) == 0


def test_daily_loss_exact_limit_is_breach():
    # day_pnl == -daily_limit → breach
    r = evaluate_risk(
        RiskInput(
            starting_balance=10_000,
            equity=9_800,
            day_pnl=-500,
            trading_days=1,
            profit_target_pct=8,
            daily_loss_pct=5,
            max_loss_pct=10,
            min_trading_days=1,
        )
    )
    assert r.kind == "breach"
    assert r.rule == "DailyLoss"


def test_max_drawdown_exact_floor_ok_one_cent_below_breaches():
    ok = evaluate_risk(
        RiskInput(
            starting_balance=10_000,
            equity=9_000,
            day_pnl=0,
            trading_days=1,
            profit_target_pct=8,
            daily_loss_pct=5,
            max_loss_pct=10,
            min_trading_days=1,
        )
    )
    assert ok.kind == "ok"
    breach = evaluate_risk(
        RiskInput(
            starting_balance=10_000,
            equity=8_999.99,
            day_pnl=0,
            trading_days=1,
            profit_target_pct=8,
            daily_loss_pct=5,
            max_loss_pct=10,
            min_trading_days=1,
        )
    )
    assert breach.kind == "breach"
    assert breach.rule == "MaxDrawdown"


def test_target_requires_min_trading_days():
    early = evaluate_risk(
        RiskInput(
            starting_balance=10_000,
            equity=10_800,
            day_pnl=0,
            trading_days=2,
            profit_target_pct=8,
            daily_loss_pct=5,
            max_loss_pct=10,
            min_trading_days=3,
        )
    )
    assert early.kind == "ok"


def test_freepass_coupon_zeros_total():
    q = apply_coupon(lookup_coupon("FREEPASS"), 549)
    assert q.final_total == 0
    assert q.discount_amount == 549


def test_flat_coupon_below_minimum_rejected():
    with pytest.raises(DomainError, match="minimum"):
        apply_coupon(lookup_coupon("FLAT50"), 20)


def test_phase_pass_rejects_non_active():
    with pytest.raises(DomainError, match="not active"):
        mark_phase_passed(1, 2, "Funded", 5)
