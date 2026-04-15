import { describe, expect, it } from "vitest";
import type { PlayerSeasonStatRow } from "@zone-blitz/shared/types/player.ts";
import {
  computeCareerTotals,
  statColumnsForBucket,
} from "./career-stats-utils.ts";

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

describe("statColumnsForBucket", () => {
  it("returns passing columns for QB", () => {
    const cols = statColumnsForBucket("QB");
    const keys = cols.map((c) => c.key);
    expect(keys).toContain("passingYards");
    expect(keys).toContain("passingTouchdowns");
    expect(keys).toContain("interceptions");
    expect(keys).toContain("completions");
    expect(keys).toContain("attempts");
    expect(keys).toContain("completionPercentage");
    expect(keys).toContain("passerRating");
  });

  it("returns rushing columns for RB", () => {
    const cols = statColumnsForBucket("RB");
    const keys = cols.map((c) => c.key);
    expect(keys).toContain("rushingYards");
    expect(keys).toContain("rushingTouchdowns");
    expect(keys).toContain("rushingAttempts");
    expect(keys).toContain("yardsPerCarry");
    expect(keys).toContain("fumbles");
  });

  it("returns receiving columns for WR and TE", () => {
    const wrCols = statColumnsForBucket("WR");
    const teCols = statColumnsForBucket("TE");
    expect(wrCols).toEqual(teCols);
    const keys = wrCols.map((c) => c.key);
    expect(keys).toContain("receptions");
    expect(keys).toContain("receivingYards");
    expect(keys).toContain("receivingTouchdowns");
    expect(keys).toContain("targets");
    expect(keys).toContain("yardsPerReception");
  });

  it("returns defensive columns for front seven and secondary", () => {
    for (const bucket of ["EDGE", "IDL", "LB", "CB", "S"] as const) {
      const cols = statColumnsForBucket(bucket);
      const keys = cols.map((c) => c.key);
      expect(keys).toContain("tackles");
      expect(keys).toContain("sacks");
      expect(keys).toContain("interceptions");
      expect(keys).toContain("passDefenses");
      expect(keys).toContain("forcedFumbles");
    }
  });

  it("returns kicking columns for K", () => {
    const cols = statColumnsForBucket("K");
    const keys = cols.map((c) => c.key);
    expect(keys).toContain("fieldGoalsMade");
    expect(keys).toContain("fieldGoalsAttempted");
    expect(keys).toContain("fieldGoalPercentage");
  });

  it("returns punting columns for P", () => {
    const cols = statColumnsForBucket("P");
    const keys = cols.map((c) => c.key);
    expect(keys).toContain("punts");
    expect(keys).toContain("puntingYards");
    expect(keys).toContain("puntingAverage");
    expect(keys).toContain("puntsInside20");
  });

  it("returns empty columns for OL buckets and LS", () => {
    for (const bucket of ["OT", "IOL", "LS"] as const) {
      expect(statColumnsForBucket(bucket)).toEqual([]);
    }
  });
});

describe("computeCareerTotals", () => {
  it("sums numeric stats across seasons", () => {
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
    expect(totals.gamesPlayed).toBe(33);
    expect(totals.gamesStarted).toBe(33);
    expect(totals.stats["passingYards"]).toBe(8000);
    expect(totals.stats["passingTouchdowns"]).toBe(60);
  });

  it("aggregates across multiple teams (mid-season trade)", () => {
    const rows = [
      row({
        id: "r1",
        team: { id: "t1", name: "Bears", city: "Chicago", abbreviation: "CHI" },
        gamesPlayed: 8,
        gamesStarted: 8,
        stats: { rushingYards: 500, rushingTouchdowns: 4 },
      }),
      row({
        id: "r2",
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
    expect(totals.gamesPlayed).toBe(17);
    expect(totals.stats["rushingYards"]).toBe(1100);
    expect(totals.stats["rushingTouchdowns"]).toBe(10);
  });

  it("returns zeros for empty rows", () => {
    const totals = computeCareerTotals([], ["passingYards"]);
    expect(totals.gamesPlayed).toBe(0);
    expect(totals.gamesStarted).toBe(0);
    expect(totals.stats["passingYards"]).toBe(0);
  });

  it("skips non-numeric stat values", () => {
    const rows = [
      row({ stats: { passingYards: 4200, note: "injured week 12" } }),
    ];
    const totals = computeCareerTotals(rows, ["passingYards", "note"]);
    expect(totals.stats["passingYards"]).toBe(4200);
    expect(totals.stats["note"]).toBe(0);
  });

  it("handles missing stat keys gracefully", () => {
    const rows = [
      row({ id: "r1", stats: { passingYards: 4200 } }),
      row({ id: "r2", stats: { passingYards: 3800, interceptions: 12 } }),
    ];
    const totals = computeCareerTotals(rows, [
      "passingYards",
      "interceptions",
    ]);
    expect(totals.stats["passingYards"]).toBe(8000);
    expect(totals.stats["interceptions"]).toBe(12);
  });
});
