from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RiskInput:
    starting_balance: float
    equity: float
    day_pnl: float
    trading_days: int
    profit_target_pct: float
    daily_loss_pct: float
    max_loss_pct: float
    min_trading_days: int


@dataclass(frozen=True)
class RiskResult:
    kind: str  # ok | breach | target
    rule: str = ""
    reason: str = ""


def evaluate_risk(inp: RiskInput) -> RiskResult:
    daily_limit = inp.starting_balance * (inp.daily_loss_pct / 100)
    if inp.day_pnl <= -daily_limit:
        return RiskResult(
            kind="breach",
            rule="DailyLoss",
            reason=f"Daily loss {inp.day_pnl:.2f} exceeded -{daily_limit:.2f}",
        )
    max_loss_floor = inp.starting_balance * (1 - inp.max_loss_pct / 100)
    if inp.equity < max_loss_floor:
        return RiskResult(
            kind="breach",
            rule="MaxDrawdown",
            reason=f"Equity {inp.equity:.2f} below floor {max_loss_floor:.2f}",
        )
    target = inp.starting_balance * (1 + inp.profit_target_pct / 100)
    if inp.equity >= target and inp.trading_days >= inp.min_trading_days:
        return RiskResult(kind="target")
    return RiskResult(kind="ok")
