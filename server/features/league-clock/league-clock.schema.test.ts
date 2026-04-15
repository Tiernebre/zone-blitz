import { assertEquals } from "@std/assert";
import {
  leagueAdvanceVote,
  leagueClock,
  leaguePhaseEnum,
  leaguePhaseStep,
  stepKindEnum,
} from "./league-clock.schema.ts";

const EXPECTED_PHASES = [
  "genesis_charter",
  "genesis_franchise_establishment",
  "genesis_staff_hiring",
  "genesis_founding_pool",
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

const EXPECTED_STEP_KINDS = ["event", "week", "window"] as const;

Deno.test("leaguePhaseEnum has all 21 phases in deterministic order", () => {
  assertEquals(leaguePhaseEnum.enumValues, [...EXPECTED_PHASES]);
});

Deno.test("genesis phases are ordered before offseason_review", () => {
  const phases = leaguePhaseEnum.enumValues;
  const genesisCharterIndex = phases.indexOf("genesis_charter");
  const offseasonReviewIndex = phases.indexOf("offseason_review");
  assertEquals(genesisCharterIndex, 0);
  assertEquals(genesisCharterIndex < offseasonReviewIndex, true);
});

Deno.test("first phase in enum is genesis_charter so new leagues start there", () => {
  assertEquals(leaguePhaseEnum.enumValues[0], "genesis_charter");
});

Deno.test("stepKindEnum has event, week, window", () => {
  assertEquals(stepKindEnum.enumValues, [...EXPECTED_STEP_KINDS]);
});

Deno.test("league_clock table has expected columns", () => {
  const columns = Object.keys(leagueClock);
  assertEquals(columns.includes("leagueId"), true);
  assertEquals(columns.includes("seasonYear"), true);
  assertEquals(columns.includes("phase"), true);
  assertEquals(columns.includes("stepIndex"), true);
  assertEquals(columns.includes("advancedAt"), true);
  assertEquals(columns.includes("advancedByUserId"), true);
  assertEquals(columns.includes("overrideReason"), true);
  assertEquals(columns.includes("overrideBlockers"), true);
  assertEquals(columns.includes("hasCompletedGenesis"), true);
});

Deno.test("league_phase_step table has expected columns", () => {
  const columns = Object.keys(leaguePhaseStep);
  assertEquals(columns.includes("id"), true);
  assertEquals(columns.includes("phase"), true);
  assertEquals(columns.includes("stepIndex"), true);
  assertEquals(columns.includes("slug"), true);
  assertEquals(columns.includes("kind"), true);
  assertEquals(columns.includes("flavorDate"), true);
});

Deno.test("league_advance_vote table has expected columns", () => {
  const columns = Object.keys(leagueAdvanceVote);
  assertEquals(columns.includes("leagueId"), true);
  assertEquals(columns.includes("teamId"), true);
  assertEquals(columns.includes("phase"), true);
  assertEquals(columns.includes("stepIndex"), true);
  assertEquals(columns.includes("readyAt"), true);
});
