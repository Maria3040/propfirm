from app.modules.payouts.domain.profit_share import (
    gross_profit,
    profit_share_cap,
    remaining_withdrawable,
)


def test_profit_share_eighty_percent():
    # $12k profit on $100k, 80% split → $9600
    assert gross_profit(112_000, 100_000) == 12_000
    assert profit_share_cap(112_000, 100_000, 80) == 9600


def test_no_profit_means_zero_share():
    assert profit_share_cap(95_000, 100_000, 80) == 0


def test_remaining_after_pending():
    assert remaining_withdrawable(9600, 2500) == 7100
    assert remaining_withdrawable(100, 150) == 0
