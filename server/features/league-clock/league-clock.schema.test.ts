import { assertEquals } from "@std/assert";
import {
  leagueAdvanceVote,
  leagueClock,
  leaguePhaseEnum,
  leaguePhaseStep,
  stepKindEnum,
} from "./league-clock.schema.ts";

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

const EXPECTED_STEP_KINDS = ["event", "week", "window"] as const;

Deno.test("leaguePhaseEnum has all 20 phases in deterministic order", () => {
  assertEquals(leaguePhaseEnum.enumValues, [...EXPECTED_PHASES]);
});

Deno.test(
  "initial_scouting sits between initial_pool and initial_draft (ADR 0034)",
  () => {
    const phases = leaguePhaseEnum.enumValues;
    const initialPoolIndex = phases.indexOf("initial_pool");
    const draftScoutingIndex = phases.indexOf("initial_scouting");
    const allocationDraftIndex = phases.indexOf("initial_draft");
    assertEquals(draftScoutingIndex, initialPoolIndex + 1);
    assertEquals(allocationDraftIndex, draftScoutingIndex + 1);
  },
);

Deno.test("initial phases are ordered before offseason_review", () => {
  const phases = leaguePhaseEnum.enumValues;
  const initialStaffHiringIndex = phases.indexOf("initial_staff_hiring");
  const offseasonReviewIndex = phases.indexOf("offseason_review");
  assertEquals(initialStaffHiringIndex, 0);
  assertEquals(initialStaffHiringIndex < offseasonReviewIndex, true);
});

Deno.test("first phase in enum is initial_staff_hiring so new leagues start there", () => {
  assertEquals(leaguePhaseEnum.enumValues[0], "initial_staff_hiring");
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
  assertEquals(columns.includes("hasCompletedInitial"), true);
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
