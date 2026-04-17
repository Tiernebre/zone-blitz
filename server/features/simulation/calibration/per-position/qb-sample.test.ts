import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { collectQbSamples } from "./qb-sample.ts";
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

function qb(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "QB",
    attributes: attrs({
      armStrength: overall,
      accuracyShort: overall,
      accuracyMedium: overall,
      accuracyDeep: overall,
      release: overall,
      decisionMaking: overall,
    }),
  };
}

function team(teamId: string, starterQb: PlayerRuntime): SimTeam {
  return {
    teamId,
    starters: [starterQb],
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

Deno.test("collectQbSamples returns one sample per team with a starter QB", () => {
  const home = team("home", qb("home-qb", 50));
  const away = team("away", qb("away-qb", 50));
  const samples = collectQbSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(samples.length, 2);
  assertEquals(samples[0].teamId, "home");
  assertEquals(samples[0].qbPlayerId, "home-qb");
  assertEquals(samples[1].teamId, "away");
});

Deno.test("collectQbSamples skips a team with no starter QB", () => {
  const home = team("home", qb("home-qb", 50));
  const away: SimTeam = { ...team("away", qb("away-qb", 50)), starters: [] };
  const samples = collectQbSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(samples.length, 1);
  assertEquals(samples[0].teamId, "home");
});

Deno.test("collectQbSamples tags sample with QB overall (mean of six signature attrs)", () => {
  const home = team(
    "home",
    {
      playerId: "home-qb",
      neutralBucket: "QB",
      attributes: attrs({
        armStrength: 60,
        accuracyShort: 70,
        accuracyMedium: 80,
        accuracyDeep: 50,
        release: 65,
        decisionMaking: 55,
      }),
    },
  );
  const away = team("away", qb("away-qb", 50));
  const [homeSample] = collectQbSamples({
    game: gameOf([]),
    home,
    away,
  });
  // (60 + 70 + 80 + 50 + 65 + 55) / 6 = 63.3333
  assertAlmostEquals(homeSample.qbOverall, 63.3333, 0.01);
});

Deno.test("collectQbSamples accumulates pass events into completion%, YPA, TD%, INT%, sack%", () => {
  const home = team("home", qb("home-qb", 50));
  const away = team("away", qb("away-qb", 50));
  const events: PlayEvent[] = [
    event({ outcome: "pass_complete", offenseTeamId: "home", yardage: 10 }),
    event({ outcome: "pass_complete", offenseTeamId: "home", yardage: 15 }),
    event({ outcome: "pass_incomplete", offenseTeamId: "home", yardage: 0 }),
    event({ outcome: "pass_incomplete", offenseTeamId: "home", yardage: 0 }),
    event({
      outcome: "touchdown",
      offenseTeamId: "home",
      yardage: 25,
      call: {
        concept: "deep_shot",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
    }),
    event({ outcome: "interception", offenseTeamId: "home", yardage: 0 }),
    event({ outcome: "sack", offenseTeamId: "home", yardage: -7 }),
  ];
  const [homeSample] = collectQbSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertEquals(homeSample.attempts, 6); // 2 complete + 2 incomplete + 1 TD (pass) + 1 INT
  assertEquals(homeSample.completions, 3);
  assertEquals(homeSample.pass_yards, 50);
  assertEquals(homeSample.pass_tds, 1);
  assertEquals(homeSample.interceptions, 1);
  assertEquals(homeSample.sacks, 1);
  assertEquals(homeSample.dropbacks, 7);
  assertAlmostEquals(homeSample.completion_pct, 0.5);
  assertAlmostEquals(homeSample.yards_per_attempt, 50 / 6, 1e-6);
  assertAlmostEquals(homeSample.td_rate, 1 / 6, 1e-6);
  assertAlmostEquals(homeSample.int_rate, 1 / 6, 1e-6);
  assertAlmostEquals(homeSample.sack_rate, 1 / 7, 1e-6);
});

Deno.test("collectQbSamples attributes pass-concept TDs to the QB but skips run-concept TDs", () => {
  const home = team("home", qb("home-qb", 50));
  const away = team("away", qb("away-qb", 50));
  const events: PlayEvent[] = [
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
    event({
      outcome: "touchdown",
      offenseTeamId: "home",
      yardage: 20,
      call: {
        concept: "quick_pass",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
    }),
  ];
  const [homeSample] = collectQbSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertEquals(homeSample.attempts, 1);
  assertEquals(homeSample.pass_tds, 1);
  assertEquals(homeSample.pass_yards, 20);
});

Deno.test("collectQbSamples isolates offense by team", () => {
  const home = team("home", qb("home-qb", 50));
  const away = team("away", qb("away-qb", 50));
  const events: PlayEvent[] = [
    event({ outcome: "pass_complete", offenseTeamId: "home", yardage: 10 }),
    event({ outcome: "pass_incomplete", offenseTeamId: "away", yardage: 0 }),
    event({ outcome: "sack", offenseTeamId: "away", yardage: -6 }),
  ];
  const [homeSample, awaySample] = collectQbSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertEquals(homeSample.attempts, 1);
  assertEquals(homeSample.sacks, 0);
  assertEquals(awaySample.attempts, 1);
  assertEquals(awaySample.sacks, 1);
});

Deno.test("collectQbSamples handles zero-attempt games without divide-by-zero", () => {
  const home = team("home", qb("home-qb", 50));
  const away = team("away", qb("away-qb", 50));
  const [sample] = collectQbSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(sample.attempts, 0);
  assertEquals(sample.completion_pct, 0);
  assertEquals(sample.yards_per_attempt, 0);
  assertEquals(sample.td_rate, 0);
  assertEquals(sample.int_rate, 0);
  assertEquals(sample.sack_rate, 0);
});
