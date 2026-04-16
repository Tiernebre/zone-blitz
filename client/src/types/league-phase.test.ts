import { describe, expect, it } from "vitest";
import { LEAGUE_PHASES } from "./league-phase.ts";

// Mirrors server/features/league-clock/league-clock.schema.test.ts. When the
// server enum changes, this list must change in lockstep — the client's
// LEAGUE_PHASES is the client-side projection of the server's leaguePhaseEnum.
const EXPECTED_PHASES = [
  "initial_staff_hiring",
  "initial_pool",
  "initial_scouting",
  "initial_draft",
  "initial_free_agency",
  "initial_kickoff",
  "offseason_review",
  "coaching_carousel",
  "tag_window",
  "restricted_fa",
  "legal_tampering",
  "free_agency",
  "pre_draft",
  "draft",
  "udfa",
  "offseason_program",
  "preseason",
  "regular_season",
  "playoffs",
  "offseason_rollover",
] as const;

describe("LEAGUE_PHASES", () => {
  it("has all 20 phases in deterministic order", () => {
    expect([...LEAGUE_PHASES]).toEqual([...EXPECTED_PHASES]);
  });

  it("places initial_scouting between initial_pool and initial_draft (ADR 0034)", () => {
    const initialPoolIndex = LEAGUE_PHASES.indexOf("initial_pool");
    const draftScoutingIndex = LEAGUE_PHASES.indexOf("initial_scouting");
    const allocationDraftIndex = LEAGUE_PHASES.indexOf(
      "initial_draft",
    );
    expect(draftScoutingIndex).toBe(initialPoolIndex + 1);
    expect(allocationDraftIndex).toBe(draftScoutingIndex + 1);
  });
});
