from __future__ import annotations

from app.shared_kernel.errors import DomainError


def mark_phase_passed(current_phase: int, phases: int, status: str, phase2_target: float) -> tuple[str, int, str, float]:
    """Returns (outcome, new_phase, new_status, new_profit_target)."""
    if status != "Active":
        raise DomainError("challenge not active")
    if current_phase < phases:
        return "advanced", current_phase + 1, "Active", phase2_target
    return "funded", current_phase, "Funded", phase2_target
