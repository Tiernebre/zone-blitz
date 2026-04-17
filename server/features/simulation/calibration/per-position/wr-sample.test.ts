import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { collectWrSamples } from "./wr-sample.ts";
import type { GameResult, PlayEvent } from "../../events.ts";
import type { SimTeam } from "../../simulate-game.ts";
import type { PlayerRuntime } from "../../resolve-play.ts";

function attrs(overrides: Partial<PlayerAttributes> = {}): PlayerAttributes {
  const base: Record<string, number> = {};
  const keys = [
    "speed",
    "acceleration",
    "agility",
    "strength",
    "jumping",
    "stamina",
    "durability",
    "armStrength",
    "accuracyShort",
    "accuracyMedium",
    "accuracyDeep",
    "accuracyOnTheRun",
    "touch",
    "release",
    "ballCarrying",
    "elusiveness",
    "routeRunning",
    "catching",
    "contestedCatching",
    "runAfterCatch",
    "passBlocking",
    "runBlocking",
    "blockShedding",
    "tackling",
    "manCoverage",
    "zoneCoverage",
    "passRushing",
    "runDefense",
    "kickingPower",
    "kickingAccuracy",
    "puntingPower",
    "puntingAccuracy",
    "snapAccuracy",
    "footballIq",
    "decisionMaking",
    "anticipation",
    "composure",
    "clutch",
    "consistency",
    "workEthic",
    "coachability",
    "leadership",
    "greed",
    "loyalty",
    "ambition",
    "vanity",
    "schemeAttachment",
    "mediaSensitivity",
  ];
  for (const k of keys) {
    base[k] = 50;
    base[`${k}Potential`] = 50;
  }
  return { ...(base as unknown as PlayerAttributes), ...overrides };
}

function wr(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "WR",
    attributes: attrs({
      routeRunning: overall,
      catching: overall,
      speed: overall,
      release: overall,
    }),
  };
}

function team(teamId: string, wrs: PlayerRuntime[]): SimTeam {
  return {
    teamId,
    starters: wrs,
    bench: [],
    fingerprint: { offense: null, defense: null, overrides: {} },
    coachingMods: {
      schemeFitBonus: 0,
      situationalBonus: 0,
      aggressiveness: 50,
      penaltyDiscipline: 1,
    },
  };
}

function event(
  overrides: Partial<PlayEvent> & {
    outcome: PlayEvent["outcome"];
    offenseTeamId: string;
  },
): PlayEvent {
  return {
    gameId: "g",
    driveIndex: 0,
    playIndex: 0,
    quarter: 1,
    clock: "15:00",
    situation: { down: 1, distance: 10, yardLine: 25 },
    defenseTeamId: overrides.offenseTeamId === "home" ? "away" : "home",
    call: {
      concept: "dropback",
      personnel: "11",
      formation: "shotgun",
      motion: "none",
    },
    coverage: { front: "4-3", coverage: "cover_2", pressure: "four_man" },
    participants: [],
    yardage: 0,
    tags: [],
    ...overrides,
  };
}

function gameOf(events: PlayEvent[]): GameResult {
  return {
    gameId: "g",
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

Deno.test("collectWrSamples returns one sample per starter WR per team", () => {
  const home = team("home", [
    wr("home-wr1", 50),
    wr("home-wr2", 50),
    wr("home-wr3", 50),
  ]);
  const away = team("away", [wr("away-wr1", 50), wr("away-wr2", 50)]);
  const samples = collectWrSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(samples.length, 5);
  assertEquals(samples[0].teamId, "home");
  assertEquals(samples[0].wrPlayerId, "home-wr1");
  assertEquals(samples[3].teamId, "away");
});

Deno.test("collectWrSamples skips a team with no starter WRs", () => {
  const home = team("home", [wr("home-wr1", 50)]);
  const away = team("away", []);
  const samples = collectWrSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(samples.length, 1);
  assertEquals(samples[0].teamId, "home");
});

Deno.test("collectWrSamples tags sample with WR overall (mean of four signature attrs)", () => {
  const home = team("home", [
    {
      playerId: "home-wr1",
      neutralBucket: "WR",
      attributes: attrs({
        routeRunning: 60,
        catching: 70,
        speed: 80,
        release: 50,
      }),
    },
  ]);
  const [sample] = collectWrSamples({
    game: gameOf([]),
    home,
    away: team("away", [wr("a", 50)]),
  });
  // (60 + 70 + 80 + 50) / 4 = 65
  assertAlmostEquals(sample.wrOverall, 65, 0.01);
});

Deno.test("collectWrSamples splits team pass stats across starter WRs by routeRunning weight", () => {
  const wr1: PlayerRuntime = {
    playerId: "home-wr1",
    neutralBucket: "WR",
    attributes: attrs({
      routeRunning: 80,
      catching: 50,
      speed: 50,
      release: 50,
    }),
  };
  const wr2: PlayerRuntime = {
    playerId: "home-wr2",
    neutralBucket: "WR",
    attributes: attrs({
      routeRunning: 20,
      catching: 50,
      speed: 50,
      release: 50,
    }),
  };
  const home = team("home", [wr1, wr2]);
  const away = team("away", [wr("a", 50)]);
  const events: PlayEvent[] = [
    event({ outcome: "pass_complete", offenseTeamId: "home", yardage: 10 }),
    event({ outcome: "pass_complete", offenseTeamId: "home", yardage: 10 }),
    event({ outcome: "pass_complete", offenseTeamId: "home", yardage: 10 }),
    event({ outcome: "pass_complete", offenseTeamId: "home", yardage: 10 }),
    event({ outcome: "pass_complete", offenseTeamId: "home", yardage: 10 }),
    event({ outcome: "pass_incomplete", offenseTeamId: "home", yardage: 0 }),
    event({ outcome: "pass_incomplete", offenseTeamId: "home", yardage: 0 }),
    event({ outcome: "pass_incomplete", offenseTeamId: "home", yardage: 0 }),
    event({ outcome: "pass_incomplete", offenseTeamId: "home", yardage: 0 }),
    event({ outcome: "pass_incomplete", offenseTeamId: "home", yardage: 0 }),
  ];
  const samples = collectWrSamples({
    game: gameOf(events),
    home,
    away,
  });
  const home1 = samples.find((s) => s.wrPlayerId === "home-wr1")!;
  const home2 = samples.find((s) => s.wrPlayerId === "home-wr2")!;

  // WR1 has routeRunning 80 of 100 total -> 0.8 share; WR2 -> 0.2.
  assertAlmostEquals(home1.targetShare, 0.8, 1e-6);
  assertAlmostEquals(home2.targetShare, 0.2, 1e-6);
  assertAlmostEquals(home1.targets, 10 * 0.8, 1e-6);
  assertAlmostEquals(home2.targets, 10 * 0.2, 1e-6);
  assertAlmostEquals(home1.receptions, 5 * 0.8, 1e-6);
  assertAlmostEquals(home1.rec_yards, 50 * 0.8, 1e-6);
  // catch_rate is share-invariant: 5/10 regardless of share split.
  assertAlmostEquals(home1.catch_rate, 0.5, 1e-6);
  assertAlmostEquals(home2.catch_rate, 0.5, 1e-6);
  // yards_per_target is also share-invariant at the per-WR level.
  assertAlmostEquals(home1.yards_per_target, 5, 1e-6);
});

Deno.test("collectWrSamples attributes pass-concept TDs to the WRs but skips run-concept TDs", () => {
  const home = team("home", [wr("home-wr1", 50)]);
  const away = team("away", [wr("away-wr1", 50)]);
  const events: PlayEvent[] = [
    event({
      outcome: "touchdown",
      offenseTeamId: "home",
      yardage: 25,
      call: {
        concept: "quick_pass",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
    }),
    event({
      outcome: "touchdown",
      offenseTeamId: "home",
      yardage: 2,
      call: {
        concept: "inside_zone",
        personnel: "11",
        formation: "singleback",
        motion: "none",
      },
    }),
  ];
  const [homeSample] = collectWrSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertEquals(homeSample.targets, 1);
  assertEquals(homeSample.receptions, 1);
  assertEquals(homeSample.rec_tds, 1);
  assertEquals(homeSample.rec_yards, 25);
});

Deno.test("collectWrSamples counts interceptions as targets but not receptions", () => {
  const home = team("home", [wr("home-wr1", 50)]);
  const away = team("away", [wr("away-wr1", 50)]);
  const events: PlayEvent[] = [
    event({ outcome: "pass_complete", offenseTeamId: "home", yardage: 10 }),
    event({ outcome: "interception", offenseTeamId: "home", yardage: 0 }),
  ];
  const [homeSample] = collectWrSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertEquals(homeSample.targets, 2);
  assertEquals(homeSample.receptions, 1);
  assertAlmostEquals(homeSample.catch_rate, 0.5);
});

Deno.test("collectWrSamples isolates offense by team", () => {
  const home = team("home", [wr("home-wr1", 50)]);
  const away = team("away", [wr("away-wr1", 50)]);
  const events: PlayEvent[] = [
    event({ outcome: "pass_complete", offenseTeamId: "home", yardage: 20 }),
    event({ outcome: "pass_complete", offenseTeamId: "away", yardage: 5 }),
    event({ outcome: "pass_complete", offenseTeamId: "away", yardage: 15 }),
  ];
  const [homeSample, awaySample] = collectWrSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertEquals(homeSample.targets, 1);
  assertEquals(homeSample.rec_yards, 20);
  assertEquals(awaySample.targets, 2);
  assertEquals(awaySample.rec_yards, 20);
});

Deno.test("collectWrSamples handles zero-target games without divide-by-zero", () => {
  const home = team("home", [wr("home-wr1", 50)]);
  const away = team("away", [wr("away-wr1", 50)]);
  const [sample] = collectWrSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(sample.targets, 0);
  assertEquals(sample.catch_rate, 0);
  assertEquals(sample.yards_per_reception, 0);
  assertEquals(sample.yards_per_target, 0);
  assertEquals(sample.td_rate, 0);
  assertEquals(sample.yards_per_game, 0);
});

Deno.test("collectWrSamples falls back to equal split when every WR has routeRunning 0", () => {
  const wr1: PlayerRuntime = {
    playerId: "home-wr1",
    neutralBucket: "WR",
    attributes: attrs({
      routeRunning: 0,
      catching: 50,
      speed: 50,
      release: 50,
    }),
  };
  const wr2: PlayerRuntime = {
    playerId: "home-wr2",
    neutralBucket: "WR",
    attributes: attrs({
      routeRunning: 0,
      catching: 50,
      speed: 50,
      release: 50,
    }),
  };
  const home = team("home", [wr1, wr2]);
  const away = team("away", [wr("away-wr1", 50)]);
  const events: PlayEvent[] = [
    event({ outcome: "pass_complete", offenseTeamId: "home", yardage: 8 }),
    event({ outcome: "pass_complete", offenseTeamId: "home", yardage: 8 }),
  ];
  const samples = collectWrSamples({
    game: gameOf(events),
    home,
    away,
  });
  const homeSamples = samples.filter((s) => s.teamId === "home");
  assertEquals(homeSamples.length, 2);
  assertAlmostEquals(homeSamples[0].targetShare, 0.5, 1e-6);
  assertAlmostEquals(homeSamples[1].targetShare, 0.5, 1e-6);
  assertAlmostEquals(homeSamples[0].targets, 1, 1e-6);
});
