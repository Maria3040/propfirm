"""Profit-share withdrawal rules (pure domain)."""

from __future__ import annotations


def gross_profit(equity: float, account_size: float) -> float:
    return max(0.0, round(float(equity) - float(account_size), 2))


def profit_share_cap(equity: float, account_size: float, profit_split_pct: float) -> float:
    """Trader's max withdrawable share of open profit on a funded account."""
    split = max(0.0, min(100.0, float(profit_split_pct or 0)))
    return round(gross_profit(equity, account_size) * (split / 100.0), 2)


def remaining_withdrawable(cap: float, already_requested: float) -> float:
    return round(max(0.0, float(cap) - max(0.0, float(already_requested))), 2)
