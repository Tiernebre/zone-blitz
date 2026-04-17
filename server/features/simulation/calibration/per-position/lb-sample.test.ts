import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { collectLbSamples } from "./lb-sample.ts";
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

function lb(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "LB",
    attributes: attrs({
      blockShedding: overall,
      tackling: overall,
      runDefense: overall,
      zoneCoverage: overall,
      footballIq: overall,
      anticipation: overall,
    }),
  };
}

function team(teamId: string, starters: PlayerRuntime[]): SimTeam {
  return {
    teamId,
    starters,
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

Deno.test("collectLbSamples returns one sample per starter LB per team", () => {
  // Two LB starters per team (typical base defense). Expect 4 samples.
  const home = team("home", [lb("home-lb1", 50), lb("home-lb2", 50)]);
  const away = team("away", [lb("away-lb1", 50), lb("away-lb2", 50)]);
  const samples = collectLbSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(samples.length, 4);
  assertEquals(samples[0].teamId, "home");
  assertEquals(samples[0].lbPlayerId, "home-lb1");
  assertEquals(samples[2].teamId, "away");
});

Deno.test("collectLbSamples skips a team with no LB starters", () => {
  const home = team("home", [lb("home-lb", 50)]);
  const away = team("away", []);
  const samples = collectLbSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(samples.length, 1);
  assertEquals(samples[0].teamId, "home");
});

Deno.test("collectLbSamples tags each sample with LB overall (mean of six attrs)", () => {
  const starter: PlayerRuntime = {
    playerId: "home-lb",
    neutralBucket: "LB",
    attributes: attrs({
      blockShedding: 60,
      tackling: 70,
      runDefense: 50,
      zoneCoverage: 40,
      footballIq: 80,
      anticipation: 60,
    }),
  };
  const home = team("home", [starter]);
  const away = team("away", [lb("away-lb", 50)]);
  const [homeSample] = collectLbSamples({
    game: gameOf([]),
    home,
    away,
  });
  // (60 + 70 + 50 + 40 + 80 + 60) / 6 = 60
  assertAlmostEquals(homeSample.lbOverall, 60, 0.001);
});

Deno.test("collectLbSamples allocates team tackles across LB starters", () => {
  const home = team("home", [lb("home-lb1", 50), lb("home-lb2", 50)]);
  const away = team("away", [lb("away-lb", 50)]);

  // Home defends 10 successful offense plays => 10 team tackles.
  const events: PlayEvent[] = [];
  for (let i = 0; i < 10; i++) {
    events.push(
      event({ outcome: "rush", offenseTeamId: "away", yardage: 4 }),
    );
  }

  const samples = collectLbSamples({
    game: gameOf(events),
    home,
    away,
  });

  const homeSamples = samples.filter((s) => s.teamId === "home");
  assertEquals(homeSamples.length, 2);
  // Team tackles = 10, LB share = 0.45, split across 2 LBs => 2.25 each.
  assertAlmostEquals(homeSamples[0].tackles_per_game, 2.25, 1e-6);
  assertAlmostEquals(homeSamples[1].tackles_per_game, 2.25, 1e-6);

  // Away team defended zero offense plays => 0 tackles.
  const awaySample = samples.find((s) => s.teamId === "away")!;
  assertEquals(awaySample.tackles_per_game, 0);
});

Deno.test("collectLbSamples counts TFLs (zero-or-negative-yardage rushes/completions)", () => {
  const home = team("home", [lb("home-lb", 50)]);
  const away = team("away", [lb("away-lb", 50)]);

  const events: PlayEvent[] = [
    event({ outcome: "rush", offenseTeamId: "away", yardage: -2 }),
    event({ outcome: "rush", offenseTeamId: "away", yardage: 0 }),
    event({ outcome: "rush", offenseTeamId: "away", yardage: 3 }),
    event({
      outcome: "pass_complete",
      offenseTeamId: "away",
      yardage: -1,
    }),
  ];

  const [homeSample] = collectLbSamples({
    game: gameOf(events),
    home,
    away,
  });

  // 3 TFLs (-2, 0, -1 yardage plays). Share = 0.45, 1 LB => 1.35.
  assertAlmostEquals(homeSample.tfl_per_game, 3 * 0.45, 1e-6);
});

Deno.test("collectLbSamples excludes sacks from TFL count (owned by pass rush)", () => {
  const home = team("home", [lb("home-lb", 50)]);
  const away = team("away", [lb("away-lb", 50)]);

  const events: PlayEvent[] = [
    event({ outcome: "sack", offenseTeamId: "away", yardage: -7 }),
    event({ outcome: "sack", offenseTeamId: "away", yardage: -5 }),
  ];

  const [homeSample] = collectLbSamples({
    game: gameOf(events),
    home,
    away,
  });

  // Sacks shouldn't credit LB tackles or TFLs.
  assertEquals(homeSample.tackles_per_game, 0);
  assertEquals(homeSample.tfl_per_game, 0);
});

Deno.test("collectLbSamples attributes PBUs as a share of incompletes", () => {
  const home = team("home", [lb("home-lb", 50)]);
  const away = team("away", [lb("away-lb", 50)]);

  // 10 incompletes => 10 * 0.4 = 4 team PBUs.
  // LB share of PBUs = 0.3, single LB => 4 * 0.3 = 1.2 PBUs/game.
  const events: PlayEvent[] = [];
  for (let i = 0; i < 10; i++) {
    events.push(
      event({ outcome: "pass_incomplete", offenseTeamId: "away" }),
    );
  }

  const [homeSample] = collectLbSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertAlmostEquals(homeSample.pbu_per_game, 1.2, 1e-6);
});

Deno.test("collectLbSamples isolates defense by team", () => {
  const home = team("home", [lb("home-lb", 50)]);
  const away = team("away", [lb("away-lb", 50)]);

  const events: PlayEvent[] = [
    event({ outcome: "rush", offenseTeamId: "away", yardage: 4 }), // home defends
    event({ outcome: "rush", offenseTeamId: "home", yardage: 4 }), // away defends
    event({ outcome: "rush", offenseTeamId: "home", yardage: 4 }), // away defends
  ];

  const samples = collectLbSamples({
    game: gameOf(events),
    home,
    away,
  });

  const homeSample = samples.find((s) => s.teamId === "home")!;
  const awaySample = samples.find((s) => s.teamId === "away")!;

  // Home defended 1 play, away defended 2. Share 0.45, 1 LB each.
  assertAlmostEquals(homeSample.tackles_per_game, 1 * 0.45, 1e-6);
  assertAlmostEquals(awaySample.tackles_per_game, 2 * 0.45, 1e-6);
});

Deno.test("collectLbSamples returns the documented NFL-mean solo_tackle_rate constant", () => {
  const home = team("home", [lb("home-lb", 50)]);
  const away = team("away", [lb("away-lb", 50)]);

  const [homeSample] = collectLbSamples({
    game: gameOf([]),
    home,
    away,
  });
  // The sim doesn't distinguish solo vs. assisted tackles, so this is
  // intentionally a constant (the NFL starter mean) — documented in
  // lb-sample.ts as a gap to close once the engine logs tacklers.
  assertAlmostEquals(homeSample.solo_tackle_rate, 0.56, 1e-6);
});

Deno.test("collectLbSamples counts fumbles as tackles with yardage-based TFL logic", () => {
  const home = team("home", [lb("home-lb", 50)]);
  const away = team("away", [lb("away-lb", 50)]);

  const events: PlayEvent[] = [
    event({ outcome: "fumble", offenseTeamId: "away", yardage: -3 }),
  ];

  const [homeSample] = collectLbSamples({
    game: gameOf(events),
    home,
    away,
  });
  // 1 tackle (fumble => the ball-carrier was brought down) and 1 TFL.
  assertAlmostEquals(homeSample.tackles_per_game, 1 * 0.45, 1e-6);
  assertAlmostEquals(homeSample.tfl_per_game, 1 * 0.45, 1e-6);
});
