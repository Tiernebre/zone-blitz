import { assertEquals } from "@std/assert";
import {
  leagueAdvanceVote,
  leagueClock,
  leaguePhaseEnum,
  leaguePhaseStep,
  stepKindEnum,
} from "./league-clock.schema.ts";

const EXPECTED_PHASES = [
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

Deno.test("leaguePhaseEnum has all 14 phases in deterministic order", () => {
  assertEquals(leaguePhaseEnum.enumValues, [...EXPECTED_PHASES]);
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
