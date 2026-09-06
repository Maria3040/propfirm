from app.modules.risk.domain.risk import RiskInput, evaluate_risk


def _base(**overrides):
    data = dict(
        starting_balance=100_000,
        equity=100_000,
        day_pnl=0,
        trading_days=0,
        profit_target_pct=8,
        daily_loss_pct=5,
        max_loss_pct=10,
        min_trading_days=3,
    )
    data.update(overrides)
    return RiskInput(**data)


def test_daily_loss_breach():
    r = evaluate_risk(_base(day_pnl=-6000))
    assert r.kind == "breach"
    assert r.rule == "DailyLoss"


def test_max_drawdown_breach():
    r = evaluate_risk(_base(equity=89_000))
    assert r.kind == "breach"
    assert r.rule == "MaxDrawdown"


def test_target_reached():
    r = evaluate_risk(_base(equity=108_000, trading_days=3))
    assert r.kind == "target"


def test_ok_when_below_target():
    r = evaluate_risk(_base(equity=105_000, trading_days=3))
    assert r.kind == "ok"
