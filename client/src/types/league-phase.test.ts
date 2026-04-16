import { describe, expect, it } from "vitest";
import { LEAGUE_PHASES } from "./league-phase.ts";

// Mirrors server/features/league-clock/league-clock.schema.test.ts. When the
// server enum changes, this list must change in lockstep — the client's
// LEAGUE_PHASES is the client-side projection of the server's leaguePhaseEnum.
const EXPECTED_PHASES = [
  "genesis_staff_hiring",
  "genesis_founding_pool",
  "genesis_draft_scouting",
  "genesis_allocation_draft",
  "genesis_free_agency",
  "genesis_kickoff",
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

  it("places genesis_draft_scouting between genesis_founding_pool and genesis_allocation_draft (ADR 0034)", () => {
    const foundingPoolIndex = LEAGUE_PHASES.indexOf("genesis_founding_pool");
    const draftScoutingIndex = LEAGUE_PHASES.indexOf("genesis_draft_scouting");
    const allocationDraftIndex = LEAGUE_PHASES.indexOf(
      "genesis_allocation_draft",
    );
    expect(draftScoutingIndex).toBe(foundingPoolIndex + 1);
    expect(allocationDraftIndex).toBe(draftScoutingIndex + 1);
  });
});
