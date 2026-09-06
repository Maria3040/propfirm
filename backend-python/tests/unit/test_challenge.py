from app.modules.challenges.domain.challenge import mark_phase_passed


def test_advance_phase():
    outcome, phase, status, target = mark_phase_passed(1, 2, "Active", 5)
    assert outcome == "advanced"
    assert phase == 2
    assert status == "Active"
    assert target == 5


def test_fund_on_last_phase():
    outcome, phase, status, target = mark_phase_passed(2, 2, "Active", 5)
    assert outcome == "funded"
    assert status == "Funded"
