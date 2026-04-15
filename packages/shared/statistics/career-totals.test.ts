import { assertEquals } from "@std/assert";
import type { PlayerSeasonStatRow } from "../types/player.ts";
import { computeCareerTotals } from "./career-totals.ts";

function row(
  overrides: Partial<PlayerSeasonStatRow> & {
    stats: Record<string, number | string>;
  },
): PlayerSeasonStatRow {
  return {
    id: "r1",
    seasonYear: 2024,
    team: { id: "t1", name: "Bears", city: "Chicago", abbreviation: "CHI" },
    playoffs: false,
    gamesPlayed: 16,
    gamesStarted: 16,
    ...overrides,
  };
}

Deno.test("computeCareerTotals — sums numeric stats across seasons", () => {
  const rows = [
    row({
      id: "r1",
      seasonYear: 2023,
      gamesPlayed: 17,
      gamesStarted: 17,
      stats: { passingYards: 4200, passingTouchdowns: 32 },
    }),
    row({
      id: "r2",
      seasonYear: 2024,
      gamesPlayed: 16,
      gamesStarted: 16,
      stats: { passingYards: 3800, passingTouchdowns: 28 },
    }),
  ];

  const totals = computeCareerTotals(rows, [
    "passingYards",
    "passingTouchdowns",
  ]);
  assertEquals(totals.gamesPlayed, 33);
  assertEquals(totals.gamesStarted, 33);
  assertEquals(totals.stats["passingYards"], 8000);
  assertEquals(totals.stats["passingTouchdowns"], 60);
});

Deno.test("computeCareerTotals — aggregates across different teams (mid-season trade)", () => {
  const rows = [
    row({
      id: "r1",
      seasonYear: 2024,
      team: { id: "t1", name: "Bears", city: "Chicago", abbreviation: "CHI" },
      gamesPlayed: 8,
      gamesStarted: 8,
      stats: { rushingYards: 500, rushingTouchdowns: 4 },
    }),
    row({
      id: "r2",
      seasonYear: 2024,
      team: {
        id: "t2",
        name: "Eagles",
        city: "Philadelphia",
        abbreviation: "PHI",
      },
      gamesPlayed: 9,
      gamesStarted: 9,
      stats: { rushingYards: 600, rushingTouchdowns: 6 },
    }),
  ];

  const totals = computeCareerTotals(rows, [
    "rushingYards",
    "rushingTouchdowns",
  ]);
  assertEquals(totals.gamesPlayed, 17);
  assertEquals(totals.gamesStarted, 17);
  assertEquals(totals.stats["rushingYards"], 1100);
  assertEquals(totals.stats["rushingTouchdowns"], 10);
});

Deno.test("computeCareerTotals — returns zeros when rows are empty", () => {
  const totals = computeCareerTotals([], ["passingYards"]);
  assertEquals(totals.gamesPlayed, 0);
  assertEquals(totals.gamesStarted, 0);
  assertEquals(totals.stats["passingYards"], 0);
});

Deno.test("computeCareerTotals — skips non-numeric stat values", () => {
  const rows = [
    row({
      id: "r1",
      stats: { passingYards: 4200, note: "injured week 12" },
    }),
  ];

  const totals = computeCareerTotals(rows, ["passingYards", "note"]);
  assertEquals(totals.stats["passingYards"], 4200);
  assertEquals(totals.stats["note"], 0);
});

Deno.test("computeCareerTotals — handles missing stat keys gracefully", () => {
  const rows = [
    row({ id: "r1", stats: { passingYards: 4200 } }),
    row({ id: "r2", stats: { passingYards: 3800, interceptions: 12 } }),
  ];

  const totals = computeCareerTotals(rows, [
    "passingYards",
    "interceptions",
  ]);
  assertEquals(totals.stats["passingYards"], 8000);
  assertEquals(totals.stats["interceptions"], 12);
});
