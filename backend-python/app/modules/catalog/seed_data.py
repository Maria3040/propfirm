from __future__ import annotations

import uuid


def _size_label(n: float) -> str:
    return f"{int(n / 1000)}K" if n >= 1000 else str(int(n))


def build_catalog() -> list[dict]:
    two_step = {
        "standard": {
            "tagline": "Highest Profit Split",
            "max_loss": 10,
            "daily": 5,
            "p1": 8,
            "p2": 5,
            "split": 80,
            "min_days": 3,
            "cycle": "Biweekly",
            "ladder": [
                (5000, 36, 278, None, False),
                (10000, 66, 531, None, False),
                (25000, 179, 1187, None, False),
                (50000, 299, 1766, None, False),
                (100000, 549, 3587, None, False),
                (200000, 1099, 7174, None, False),
            ],
        },
        "flex": {
            "tagline": "Biggest Max Loss",
            "max_loss": 12,
            "daily": 4,
            "p1": 10,
            "p2": 6,
            "split": 95,
            "min_days": 1,
            "cycle": "Bi-Weekly",
            "ladder": [
                (5000, 32, 389, None, False),
                (10000, 59, 743, None, False),
                (25000, 159, 1661, None, False),
                (50000, 269, 2471, None, False),
                (100000, 499, 5020, 555, True),
                (200000, 999, 10040, None, False),
            ],
        },
        "pro": {
            "tagline": "Lowest Profit Target",
            "max_loss": 6,
            "daily": 3,
            "p1": 6,
            "p2": 6,
            "split": 80,
            "min_days": 2,
            "cycle": "Weekly",
            "ladder": [
                (5000, 29, 231, None, False),
                (10000, 55, 441, None, False),
                (25000, 134, 986, None, False),
                (50000, 224, 1467, None, False),
                (100000, 422, 2980, None, False),
                (200000, 844, 5960, None, False),
            ],
        },
    }
    out: list[dict] = []
    for variant, meta in two_step.items():
        name_v = variant.capitalize()
        for size, price, avg, compare, popular in meta["ladder"]:
            out.append(
                {
                    "id": str(uuid.uuid4()),
                    "sku": f"2STEP-{variant.upper()}-{_size_label(size)}",
                    "name": f"2-Step {name_v} ${_size_label(size)}",
                    "description": f"2-phase evaluation · {meta['tagline']}",
                    "phase_family": "two_step",
                    "variant": variant,
                    "variant_tagline": meta["tagline"],
                    "account_size": float(size),
                    "price": float(price),
                    "compare_price": float(compare) if compare else None,
                    "phases": 2,
                    "profit_target_pct": float(meta["p1"]),
                    "phase1_target_pct": float(meta["p1"]),
                    "phase2_target_pct": float(meta["p2"]),
                    "daily_loss_pct": float(meta["daily"]),
                    "max_loss_pct": float(meta["max_loss"]),
                    "min_trading_days": int(meta["min_days"]),
                    "profit_split_pct": float(meta["split"]),
                    "reward_cycle": meta["cycle"],
                    "avg_first_reward": float(avg),
                    "is_most_popular": bool(popular and variant == "flex"),
                    "is_active": True,
                }
            )
    sizes = [5000, 10000, 25000, 50000, 100000, 200000]
    one_prices = [66, 99, 199, 329, 599, 1199]
    one_avgs = [350, 680, 1400, 2200, 4500, 9000]
    for i, size in enumerate(sizes):
        out.append(
            {
                "id": str(uuid.uuid4()),
                "sku": f"1STEP-FLEX-{_size_label(size)}",
                "name": f"1-Step Flex ${_size_label(size)}",
                "description": "Single-phase challenge · New",
                "phase_family": "one_step_flex",
                "variant": "flex",
                "variant_tagline": "Biggest Max Loss",
                "account_size": float(size),
                "price": float(one_prices[i]),
                "compare_price": None,
                "phases": 1,
                "profit_target_pct": 10,
                "phase1_target_pct": 10,
                "phase2_target_pct": 0,
                "daily_loss_pct": 4,
                "max_loss_pct": 12,
                "min_trading_days": 0,
                "profit_split_pct": 95,
                "reward_cycle": "Bi-Weekly",
                "avg_first_reward": float(one_avgs[i]),
                "is_most_popular": size == 100000,
                "is_active": True,
            }
        )
    zero_prices = [60, 99, 219, 379, 699, 1399]
    zero_avgs = [400, 800, 1700, 2800, 5500, 11000]
    for i, size in enumerate(sizes):
        out.append(
            {
                "id": str(uuid.uuid4()),
                "sku": f"ZERO-{_size_label(size)}",
                "name": f"Zero ${_size_label(size)}",
                "description": "Instant / zero-step path (simulated)",
                "phase_family": "zero",
                "variant": "standard",
                "variant_tagline": "Highest Profit Split",
                "account_size": float(size),
                "price": float(zero_prices[i]),
                "compare_price": None,
                "phases": 1,
                "profit_target_pct": 0,
                "phase1_target_pct": 0,
                "phase2_target_pct": 0,
                "daily_loss_pct": 4,
                "max_loss_pct": 10,
                "min_trading_days": 0,
                "profit_split_pct": 85,
                "reward_cycle": "Weekly",
                "avg_first_reward": float(zero_avgs[i]),
                "is_most_popular": size == 100000,
                "is_active": True,
            }
        )
    return out
