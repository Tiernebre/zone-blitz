import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { collectRbSamples } from "./rb-sample.ts";
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

function rb(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "RB",
    attributes: attrs({
      ballCarrying: overall,
      elusiveness: overall,
      acceleration: overall,
      speed: overall,
    }),
  };
}

function team(teamId: string, starterRb: PlayerRuntime): SimTeam {
  return {
    teamId,
    starters: [starterRb],
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
      concept: "inside_zone",
      personnel: "11",
      formation: "singleback",
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

Deno.test("collectRbSamples returns one sample per team with a starter RB", () => {
  const home = team("home", rb("home-rb", 50));
  const away = team("away", rb("away-rb", 50));
  const samples = collectRbSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(samples.length, 2);
  assertEquals(samples[0].teamId, "home");
  assertEquals(samples[0].rbPlayerId, "home-rb");
  assertEquals(samples[1].teamId, "away");
});

Deno.test("collectRbSamples skips a team with no starter RB", () => {
  const home = team("home", rb("home-rb", 50));
  const away: SimTeam = { ...team("away", rb("away-rb", 50)), starters: [] };
  const samples = collectRbSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(samples.length, 1);
  assertEquals(samples[0].teamId, "home");
});

Deno.test("collectRbSamples tags sample with RB overall (mean of four signature attrs)", () => {
  const home = team(
    "home",
    {
      playerId: "home-rb",
      neutralBucket: "RB",
      attributes: attrs({
        ballCarrying: 60,
        elusiveness: 70,
        acceleration: 80,
        speed: 50,
      }),
    },
  );
  const away = team("away", rb("away-rb", 50));
  const [homeSample] = collectRbSamples({
    game: gameOf([]),
    home,
    away,
  });
  // (60 + 70 + 80 + 50) / 4 = 65
  assertAlmostEquals(homeSample.rbOverall, 65, 0.01);
});

Deno.test("collectRbSamples accumulates rush events into YPC, per-game yards, TD rate, fumble rate", () => {
  const home = team("home", rb("home-rb", 50));
  const away = team("away", rb("away-rb", 50));
  const events: PlayEvent[] = [
    event({ outcome: "rush", offenseTeamId: "home", yardage: 5 }),
    event({ outcome: "rush", offenseTeamId: "home", yardage: 3 }),
    event({ outcome: "rush", offenseTeamId: "home", yardage: -2 }),
    event({
      outcome: "touchdown",
      offenseTeamId: "home",
      yardage: 4,
      call: {
        concept: "inside_zone",
        personnel: "11",
        formation: "singleback",
        motion: "none",
      },
    }),
    event({ outcome: "fumble", offenseTeamId: "home", yardage: 2 }),
  ];
  const [homeSample] = collectRbSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertEquals(homeSample.carries, 5);
  assertEquals(homeSample.rush_yards, 12);
  assertEquals(homeSample.rush_tds, 1);
  assertEquals(homeSample.fumbles_lost, 1);
  assertAlmostEquals(homeSample.yards_per_carry, 12 / 5, 1e-6);
  assertAlmostEquals(homeSample.rush_td_rate, 1 / 5, 1e-6);
  assertAlmostEquals(homeSample.yards_per_game, 12);
  assertAlmostEquals(homeSample.fumble_rate, 1 / 5, 1e-6);
});

Deno.test("collectRbSamples attributes run-concept TDs to the RB but skips pass-concept TDs", () => {
  const home = team("home", rb("home-rb", 50));
  const away = team("away", rb("away-rb", 50));
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
  const [homeSample] = collectRbSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertEquals(homeSample.carries, 1);
  assertEquals(homeSample.rush_tds, 1);
  assertEquals(homeSample.rush_yards, 2);
});

Deno.test("collectRbSamples isolates offense by team", () => {
  const home = team("home", rb("home-rb", 50));
  const away = team("away", rb("away-rb", 50));
  const events: PlayEvent[] = [
    event({ outcome: "rush", offenseTeamId: "home", yardage: 4 }),
    event({ outcome: "rush", offenseTeamId: "away", yardage: 8 }),
    event({ outcome: "fumble", offenseTeamId: "away", yardage: 1 }),
  ];
  const [homeSample, awaySample] = collectRbSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertEquals(homeSample.carries, 1);
  assertEquals(homeSample.fumbles_lost, 0);
  assertEquals(awaySample.carries, 2);
  assertEquals(awaySample.fumbles_lost, 1);
});

Deno.test("collectRbSamples handles zero-carry games without divide-by-zero", () => {
  const home = team("home", rb("home-rb", 50));
  const away = team("away", rb("away-rb", 50));
  const [sample] = collectRbSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(sample.carries, 0);
  assertEquals(sample.yards_per_carry, 0);
  assertEquals(sample.rush_td_rate, 0);
  assertEquals(sample.yards_per_game, 0);
  assertEquals(sample.fumble_rate, 0);
});
