package domain

import "testing"

func TestMarkPhasePassedAdvancesThenFunds(t *testing.T) {
	c := Challenge{Status: StatusActive, CurrentPhase: 1, Phases: 2, Phase2TargetPct: 5}
	out, err := c.MarkPhasePassed()
	if err != nil || out != "advanced" || c.CurrentPhase != 2 {
		t.Fatalf("advanced: %s %+v %v", out, c, err)
	}
	out, err = c.MarkPhasePassed()
	if err != nil || out != "funded" || c.Status != StatusFunded {
		t.Fatalf("funded: %s %+v %v", out, c, err)
	}
}
