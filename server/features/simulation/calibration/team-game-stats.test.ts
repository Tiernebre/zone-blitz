import { assertAlmostEquals, assertEquals } from "@std/assert";
import { deriveTeamGameStats } from "./team-game-stats.ts";
import type { GameResult, PlayEvent } from "../events.ts";

function makeEvent(
  overrides: Partial<PlayEvent> & {
    outcome: PlayEvent["outcome"];
    offenseTeamId: string;
  },
): PlayEvent {
  return {
    gameId: "test-game",
    driveIndex: 0,
    playIndex: 0,
    quarter: 1,
    clock: "15:00",
    situation: { down: 1, distance: 10, yardLine: 25 },
    defenseTeamId: overrides.offenseTeamId === "home" ? "away" : "home",
    call: {
      concept: "inside_zone",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    },
    coverage: { front: "4-3", coverage: "cover3", pressure: "none" },
    participants: [],
    yardage: 0,
    tags: [],
    ...overrides,
  };
}

function makeGameResult(events: PlayEvent[]): GameResult {
  return {
    gameId: "test-game",
    seed: 1,
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

Deno.test("deriveTeamGameStats returns two samples per game (home + away)", () => {
  const events: PlayEvent[] = [
    makeEvent({ outcome: "rush", offenseTeamId: "home", yardage: 5 }),
    makeEvent({ outcome: "rush", offenseTeamId: "away", yardage: 3 }),
  ];
  const result = deriveTeamGameStats(makeGameResult(events), "home", "away");
  assertEquals(result.length, 2);
  assertEquals(result[0].teamId, "home");
  assertEquals(result[1].teamId, "away");
});

Deno.test("deriveTeamGameStats counts rush plays correctly", () => {
  const events: PlayEvent[] = [
    makeEvent({ outcome: "rush", offenseTeamId: "home", yardage: 5 }),
    makeEvent({ outcome: "rush", offenseTeamId: "home", yardage: 3 }),
    makeEvent({
      outcome: "fumble",
      offenseTeamId: "home",
      yardage: 2,
      tags: ["turnover"],
    }),
  ];
  const [home] = deriveTeamGameStats(makeGameResult(events), "home", "away");
  assertEquals(home.rush_attempts, 3);
  assertEquals(home.rush_yards, 10);
  assertEquals(home.plays, 3);
});

Deno.test("deriveTeamGameStats counts pass plays correctly", () => {
  const events: PlayEvent[] = [
    makeEvent({
      outcome: "pass_complete",
      offenseTeamId: "home",
      yardage: 15,
      call: {
        concept: "slant",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
    }),
    makeEvent({
      outcome: "pass_incomplete",
      offenseTeamId: "home",
      yardage: 0,
      call: {
        concept: "deep_post",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
    }),
    makeEvent({
      outcome: "sack",
      offenseTeamId: "home",
      yardage: -7,
      call: {
        concept: "slant",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
    }),
    makeEvent({
      outcome: "interception",
      offenseTeamId: "home",
      yardage: 0,
      tags: ["turnover"],
      call: {
        concept: "go_route",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
    }),
  ];
  const [home] = deriveTeamGameStats(makeGameResult(events), "home", "away");
  assertEquals(home.pass_attempts, 4);
  assertEquals(home.plays, 4);
  assertEquals(home.pass_yards, 15);
  assertEquals(home.sacks_taken, 1);
  assertEquals(home.interceptions, 1);
});

Deno.test("deriveTeamGameStats computes rates correctly", () => {
  const events: PlayEvent[] = [
    makeEvent({
      outcome: "pass_complete",
      offenseTeamId: "home",
      yardage: 10,
      call: {
        concept: "slant",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
    }),
    makeEvent({
      outcome: "pass_incomplete",
      offenseTeamId: "home",
      yardage: 0,
      call: {
        concept: "go_route",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
    }),
    makeEvent({ outcome: "rush", offenseTeamId: "home", yardage: 4 }),
    makeEvent({ outcome: "rush", offenseTeamId: "home", yardage: 6 }),
  ];
  const [home] = deriveTeamGameStats(makeGameResult(events), "home", "away");
  assertEquals(home.plays, 4);
  assertEquals(home.pass_attempts, 2);
  assertEquals(home.rush_attempts, 2);
  assertAlmostEquals(home.pass_rate, 0.5);
  assertAlmostEquals(home.rush_rate, 0.5);
  assertAlmostEquals(home.completion_pct, 0.5);
  assertAlmostEquals(home.yards_per_attempt, 5.0);
  assertAlmostEquals(home.yards_per_carry, 5.0);
});

Deno.test("deriveTeamGameStats handles touchdown events based on call concept", () => {
  const events: PlayEvent[] = [
    makeEvent({
      outcome: "touchdown",
      offenseTeamId: "home",
      yardage: 20,
      call: {
        concept: "slant",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
    }),
    makeEvent({
      outcome: "touchdown",
      offenseTeamId: "home",
      yardage: 5,
      call: {
        concept: "inside_zone",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
    }),
  ];
  const [home] = deriveTeamGameStats(makeGameResult(events), "home", "away");
  assertEquals(home.pass_attempts, 1);
  assertEquals(home.rush_attempts, 1);
  assertEquals(home.pass_yards, 20);
  assertEquals(home.rush_yards, 5);
});

Deno.test("deriveTeamGameStats counts penalties", () => {
  const events: PlayEvent[] = [
    makeEvent({
      outcome: "rush",
      offenseTeamId: "home",
      yardage: 5,
      tags: ["penalty"],
      penalty: {
        type: "holding",
        phase: "post_snap",
        yardage: 10,
        automaticFirstDown: false,
        againstTeamId: "home",
        againstPlayerId: null,
        accepted: true,
      },
    }),
    makeEvent({
      outcome: "rush",
      offenseTeamId: "home",
      yardage: 3,
      tags: ["penalty"],
      penalty: {
        type: "offsides",
        phase: "pre_snap",
        yardage: 5,
        automaticFirstDown: false,
        againstTeamId: "away",
        againstPlayerId: null,
        accepted: true,
      },
    }),
  ];
  const [home, away] = deriveTeamGameStats(
    makeGameResult(events),
    "home",
    "away",
  );
  assertEquals(home.penalties, 1);
  assertEquals(away.penalties, 1);
});

Deno.test("deriveTeamGameStats counts fumbles_lost and turnovers", () => {
  const events: PlayEvent[] = [
    makeEvent({
      outcome: "fumble",
      offenseTeamId: "home",
      yardage: 2,
      tags: ["turnover", "fumble"],
    }),
    makeEvent({
      outcome: "interception",
      offenseTeamId: "home",
      yardage: 0,
      tags: ["turnover", "interception"],
      call: {
        concept: "slant",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
    }),
  ];
  const [home] = deriveTeamGameStats(makeGameResult(events), "home", "away");
  assertEquals(home.fumbles_lost, 1);
  assertEquals(home.interceptions, 1);
  assertEquals(home.turnovers, 2);
});

Deno.test("deriveTeamGameStats skips kickoff, kneel, xp, two_point, spike events", () => {
  const events: PlayEvent[] = [
    makeEvent({ outcome: "kickoff", offenseTeamId: "home", yardage: 0 }),
    makeEvent({ outcome: "kneel", offenseTeamId: "home", yardage: -1 }),
    makeEvent({ outcome: "xp", offenseTeamId: "home", yardage: 0 }),
    makeEvent({ outcome: "two_point", offenseTeamId: "home", yardage: 0 }),
    makeEvent({ outcome: "spike", offenseTeamId: "home", yardage: 0 }),
    makeEvent({ outcome: "rush", offenseTeamId: "home", yardage: 5 }),
  ];
  const [home] = deriveTeamGameStats(makeGameResult(events), "home", "away");
  assertEquals(home.plays, 1);
  assertEquals(home.rush_attempts, 1);
});

Deno.test("deriveTeamGameStats handles zero pass attempts gracefully", () => {
  const events: PlayEvent[] = [
    makeEvent({ outcome: "rush", offenseTeamId: "home", yardage: 5 }),
  ];
  const [home] = deriveTeamGameStats(makeGameResult(events), "home", "away");
  assertEquals(home.completion_pct, 0);
  assertEquals(home.yards_per_attempt, 0);
});

Deno.test("deriveTeamGameStats handles zero rush attempts gracefully", () => {
  const events: PlayEvent[] = [
    makeEvent({
      outcome: "pass_complete",
      offenseTeamId: "home",
      yardage: 10,
      call: {
        concept: "slant",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
    }),
  ];
  const [home] = deriveTeamGameStats(makeGameResult(events), "home", "away");
  assertEquals(home.yards_per_carry, 0);
});
