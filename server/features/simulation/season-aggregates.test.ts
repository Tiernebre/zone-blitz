import { assertEquals } from "@std/assert";
import type { GameResult, PlayEvent } from "./events.ts";
import { computeSeasonAggregates } from "./season-aggregates.ts";

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
    boxScore: {
      home: {
        totalYards: 0,
        passingYards: 0,
        rushingYards: 0,
        turnovers: 0,
        sacks: 0,
        penalties: 0,
      },
      away: {
        totalYards: 0,
        passingYards: 0,
        rushingYards: 0,
        turnovers: 0,
        sacks: 0,
        penalties: 0,
      },
    },
    driveLog: [],
    injuryReport: [],
  };
}

Deno.test("computeSeasonAggregates counts rush and pass plays", () => {
  const events = [
    makeEvent({ outcome: "rush", yardage: 5 }),
    makeEvent({ outcome: "rush", yardage: 3 }),
    makeEvent({ outcome: "pass_complete", yardage: 12 }),
    makeEvent({ outcome: "pass_incomplete", yardage: 0 }),
  ];
  const agg = computeSeasonAggregates([makeGameResult(events)]);
  assertEquals(agg.totalGames, 1);
  assertEquals(agg.playsPerGame, 4);
  assertEquals(agg.rushPercentage, 50);
  assertEquals(agg.passPercentage, 50);
  assertEquals(agg.completionPercentage, 50);
  assertEquals(agg.yardsPerAttempt, 6);
  assertEquals(agg.yardsPerCarry, 4);
});

Deno.test("computeSeasonAggregates counts sacks and turnovers", () => {
  const events = [
    makeEvent({ outcome: "sack", yardage: -7, tags: ["sack", "pressure"] }),
    makeEvent({ outcome: "sack", yardage: -5, tags: ["sack", "pressure"] }),
    makeEvent({
      outcome: "interception",
      yardage: 0,
      tags: ["interception", "turnover"],
    }),
    makeEvent({
      outcome: "fumble",
      yardage: 2,
      tags: ["fumble", "turnover"],
    }),
  ];
  const agg = computeSeasonAggregates([makeGameResult(events)]);
  assertEquals(agg.sacksPerTeamPerGame, 1);
  assertEquals(agg.turnoversPerTeamPerGame, 1);
});

Deno.test("computeSeasonAggregates handles zero games", () => {
  const agg = computeSeasonAggregates([]);
  assertEquals(agg.playsPerGame, 0);
  assertEquals(agg.passPercentage, 0);
  assertEquals(agg.totalGames, 0);
});

Deno.test("computeSeasonAggregates computes averageDriveStartYardLine from drive log", () => {
  const events = [
    makeEvent({
      driveIndex: 0,
      situation: { down: 1, distance: 10, yardLine: 25 },
    }),
    makeEvent({
      driveIndex: 1,
      situation: { down: 1, distance: 10, yardLine: 35 },
    }),
  ];
  const result = makeGameResult(events);
  result.driveLog = [
    {
      driveIndex: 0,
      offenseTeamId: "home",
      startYardLine: 25,
      plays: 1,
      yards: 5,
      result: "punt",
    },
    {
      driveIndex: 1,
      offenseTeamId: "away",
      startYardLine: 35,
      plays: 1,
      yards: 5,
      result: "punt",
    },
  ];
  const agg = computeSeasonAggregates([result]);
  assertEquals(agg.averageDriveStartYardLine, 30);
});
