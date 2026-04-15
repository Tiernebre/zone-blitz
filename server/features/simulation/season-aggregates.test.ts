import { assertEquals } from "@std/assert";
import type { GameResult, PlayEvent } from "./events.ts";
import {
  computeGameAggregates,
  computeSeasonAggregates,
} from "./season-aggregates.ts";

function makeEvent(overrides: Partial<PlayEvent>): PlayEvent {
  return {
    gameId: "game-1",
    driveIndex: 0,
    playIndex: 0,
    quarter: 1,
    clock: "15:00",
    situation: { down: 1, distance: 10, yardLine: 30 },
    offenseTeamId: "home",
    defenseTeamId: "away",
    call: {
      concept: "dropback",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    },
    coverage: { front: "4-3", coverage: "cover_3", pressure: "four_man" },
    participants: [],
    outcome: "rush",
    yardage: 5,
    tags: [],
    ...overrides,
  };
}

function makeGameResult(events: PlayEvent[]): GameResult {
  return {
    gameId: "game-1",
    seed: 42,
    finalScore: { home: 0, away: 0 },
    events,
    boxScore: {},
    driveLog: [],
    injuryReport: [],
  };
}

Deno.test("computeGameAggregates counts rush plays", () => {
  const events = [
    makeEvent({ outcome: "rush", yardage: 5 }),
    makeEvent({ outcome: "rush", yardage: 3 }),
  ];
  const agg = computeGameAggregates([makeGameResult(events)]);
  assertEquals(agg.rushPlays, 2);
  assertEquals(agg.rushYards, 8);
  assertEquals(agg.totalPlays, 2);
});

Deno.test("computeGameAggregates counts pass attempts and completions", () => {
  const events = [
    makeEvent({ outcome: "pass_complete", yardage: 12 }),
    makeEvent({ outcome: "pass_incomplete", yardage: 0 }),
    makeEvent({
      outcome: "interception",
      yardage: 0,
      tags: ["interception", "turnover"],
    }),
  ];
  const agg = computeGameAggregates([makeGameResult(events)]);
  assertEquals(agg.passAttempts, 3);
  assertEquals(agg.completions, 1);
  assertEquals(agg.passYards, 12);
});

Deno.test("computeGameAggregates counts sacks", () => {
  const events = [
    makeEvent({ outcome: "sack", yardage: -7, tags: ["sack", "pressure"] }),
  ];
  const agg = computeGameAggregates([makeGameResult(events)]);
  assertEquals(agg.sacks, 1);
  assertEquals(agg.passAttempts, 1);
});

Deno.test("computeGameAggregates counts turnovers", () => {
  const events = [
    makeEvent({ outcome: "fumble", yardage: 2, tags: ["fumble", "turnover"] }),
    makeEvent({
      outcome: "interception",
      yardage: 0,
      tags: ["interception", "turnover"],
    }),
  ];
  const agg = computeGameAggregates([makeGameResult(events)]);
  assertEquals(agg.turnovers, 2);
});

Deno.test("computeGameAggregates returns zero for empty results", () => {
  const agg = computeGameAggregates([]);
  assertEquals(agg.totalPlays, 0);
  assertEquals(agg.games, 0);
});

Deno.test("computeSeasonAggregates computes ratios correctly", () => {
  const events = [
    makeEvent({ outcome: "rush", yardage: 4 }),
    makeEvent({ outcome: "rush", yardage: 5 }),
    makeEvent({ outcome: "pass_complete", yardage: 10 }),
    makeEvent({ outcome: "pass_incomplete", yardage: 0 }),
  ];
  const agg = computeSeasonAggregates([makeGameResult(events)]);
  assertEquals(agg.totalGames, 1);
  assertEquals(agg.playsPerGame, 4);
  assertEquals(agg.rushPercentage, 50);
  assertEquals(agg.passPercentage, 50);
  assertEquals(agg.completionPercentage, 50);
  assertEquals(agg.yardsPerAttempt, 5);
  assertEquals(agg.yardsPerCarry, 4.5);
});

Deno.test("computeSeasonAggregates handles zero games", () => {
  const agg = computeSeasonAggregates([]);
  assertEquals(agg.playsPerGame, 0);
  assertEquals(agg.passPercentage, 0);
  assertEquals(agg.totalGames, 0);
});

Deno.test("computeSeasonAggregates per-team sacks divided by 2x games", () => {
  const events = [
    makeEvent({ outcome: "sack", yardage: -5, tags: ["sack", "pressure"] }),
    makeEvent({ outcome: "sack", yardage: -3, tags: ["sack", "pressure"] }),
    makeEvent({ outcome: "sack", yardage: -8, tags: ["sack", "pressure"] }),
    makeEvent({ outcome: "sack", yardage: -4, tags: ["sack", "pressure"] }),
  ];
  const agg = computeSeasonAggregates([makeGameResult(events)]);
  assertEquals(agg.sacksPerTeamPerGame, 2);
});
