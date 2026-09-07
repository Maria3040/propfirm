using PropFirm.SharedKernel;

namespace PropFirm.Domain.Modules.Challenges;

public static class ChallengeStatuses
{
    public const string Active = "Active";
    public const string Funded = "Funded";
    public const string Passed = "Passed";
    public const string Failed = "Failed";
    public const string Closed = "Closed";
}

/// <summary>Phase progression for multi-step challenges (pure domain).</summary>
public static class ChallengeProgression
{
    public static string OnTargetHit(string currentStatus, int currentPhase, int totalPhases)
    {
        if (currentStatus is ChallengeStatuses.Failed or ChallengeStatuses.Closed or ChallengeStatuses.Passed)
            throw new DomainError("challenge already closed, failed, or passed");

        if (currentPhase >= totalPhases)
            return ChallengeStatuses.Funded;

        // Mid-evaluation: auto-advance (caller resets equity + issues new credentials).
        return ChallengeStatuses.Active;
    }

    public static int NextPhase(int currentPhase, int totalPhases) =>
        Math.Min(currentPhase + 1, totalPhases);

    public static decimal TargetPctForPhase(int phase, decimal phase1, decimal phase2, decimal fallback)
    {
        if (phase <= 1)
            return phase1 > 0 ? phase1 : fallback;
        return phase2 > 0 ? phase2 : fallback;
    }
}
