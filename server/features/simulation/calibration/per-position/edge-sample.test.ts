import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { collectEdgeSamples } from "./edge-sample.ts";
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

function edgeRuntime(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "EDGE",
    attributes: attrs({
      passRushing: overall,
      acceleration: overall,
      strength: overall,
      blockShedding: overall,
      runDefense: overall,
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
    defenseTeamId: string;
  },
): PlayEvent {
  return {
    gameId: "g",
    driveIndex: 0,
    playIndex: 0,
    quarter: 1,
    clock: "15:00",
    situation: { down: 1, distance: 10, yardLine: 25 },
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

Deno.test("collectEdgeSamples returns one sample per EDGE starter on each team", () => {
  const home = team("home", [
    edgeRuntime("home-edge-1", 60),
    edgeRuntime("home-edge-2", 60),
  ]);
  const away = team("away", [edgeRuntime("away-edge", 50)]);
  const samples = collectEdgeSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(samples.length, 3);
  assertEquals(samples[0].teamId, "home");
  assertEquals(samples[2].teamId, "away");
});

Deno.test("collectEdgeSamples skips a team with no EDGE starter", () => {
  const home = team("home", [edgeRuntime("home-edge", 50)]);
  const away = team("away", []);
  const samples = collectEdgeSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(samples.length, 1);
  assertEquals(samples[0].teamId, "home");
});

Deno.test("collectEdgeSamples tags sample with EDGE overall (mean of five signature attrs)", () => {
  const home = team("home", [
    {
      playerId: "home-edge",
      neutralBucket: "EDGE",
      attributes: attrs({
        passRushing: 80,
        acceleration: 70,
        strength: 60,
        blockShedding: 50,
        runDefense: 40,
      }),
    },
  ]);
  const away = team("away", [edgeRuntime("away-edge", 50)]);
  const [homeSample] = collectEdgeSamples({
    game: gameOf([]),
    home,
    away,
  });
  // (80 + 70 + 60 + 50 + 40) / 5 = 60
  assertAlmostEquals(homeSample.edgeOverall, 60, 0.01);
});

Deno.test("collectEdgeSamples attributes sacks to the participant tagged 'sack'", () => {
  const home = team("home", [
    edgeRuntime("home-edge-1", 60),
    edgeRuntime("home-edge-2", 60),
  ]);
  const away = team("away", [edgeRuntime("away-edge", 50)]);
  const events: PlayEvent[] = [
    // Home team defense sacks the away QB — participant home-edge-1 gets credit.
    event({
      outcome: "sack",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: -7,
      tags: ["sack", "pressure"],
      participants: [
        { role: "pass_rush", playerId: "home-edge-1", tags: ["sack"] },
      ],
    }),
    // Sack on the other side shouldn't leak into home-edge samples.
    event({
      outcome: "sack",
      offenseTeamId: "home",
      defenseTeamId: "away",
      yardage: -5,
      tags: ["sack", "pressure"],
      participants: [
        { role: "pass_rush", playerId: "away-edge", tags: ["sack"] },
      ],
    }),
  ];
  const samples = collectEdgeSamples({
    game: gameOf(events),
    home,
    away,
  });
  const h1 = samples.find((s) => s.edgePlayerId === "home-edge-1")!;
  const h2 = samples.find((s) => s.edgePlayerId === "home-edge-2")!;
  const a = samples.find((s) => s.edgePlayerId === "away-edge")!;
  assertEquals(h1.sacks, 1);
  assertEquals(h2.sacks, 0);
  assertEquals(a.sacks, 1);
});

Deno.test("collectEdgeSamples allocates team pressures across EDGE starters by passRushing share", () => {
  // Home team has two EDGEs: 80 and 20 passRushing. Three team pressures
  // should split 80/100 vs 20/100 — 2.4 to the stronger rusher.
  const strong: PlayerRuntime = {
    playerId: "strong",
    neutralBucket: "EDGE",
    attributes: attrs({
      passRushing: 80,
      acceleration: 60,
      strength: 60,
      blockShedding: 50,
      runDefense: 50,
    }),
  };
  const weak: PlayerRuntime = {
    playerId: "weak",
    neutralBucket: "EDGE",
    attributes: attrs({
      passRushing: 20,
      acceleration: 60,
      strength: 60,
      blockShedding: 50,
      runDefense: 50,
    }),
  };
  const home = team("home", [strong, weak]);
  const away = team("away", [edgeRuntime("away-edge", 50)]);
  const events: PlayEvent[] = [
    event({
      outcome: "sack",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: -6,
      tags: ["sack", "pressure"],
      participants: [],
    }),
    event({
      outcome: "pass_incomplete",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: 0,
      tags: ["pressure"],
    }),
    event({
      outcome: "pass_complete",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: 5,
      tags: ["pressure"],
    }),
  ];
  const samples = collectEdgeSamples({
    game: gameOf(events),
    home,
    away,
  });
  const strongSample = samples.find((s) => s.edgePlayerId === "strong")!;
  const weakSample = samples.find((s) => s.edgePlayerId === "weak")!;
  assertAlmostEquals(strongSample.qb_hits, 3 * (80 / 100), 1e-9);
  assertAlmostEquals(weakSample.qb_hits, 3 * (20 / 100), 1e-9);
});

Deno.test("collectEdgeSamples falls back to even split when every EDGE has 0 passRushing", () => {
  const a: PlayerRuntime = {
    playerId: "a",
    neutralBucket: "EDGE",
    attributes: attrs({ passRushing: 0 }),
  };
  const b: PlayerRuntime = {
    playerId: "b",
    neutralBucket: "EDGE",
    attributes: attrs({ passRushing: 0 }),
  };
  const home = team("home", [a, b]);
  const away = team("away", [edgeRuntime("away-edge", 50)]);
  const events: PlayEvent[] = [
    event({
      outcome: "pass_incomplete",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: 0,
      tags: ["pressure"],
    }),
    event({
      outcome: "pass_incomplete",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: 0,
      tags: ["pressure"],
    }),
  ];
  const samples = collectEdgeSamples({
    game: gameOf(events),
    home,
    away,
  });
  const aSample = samples.find((s) => s.edgePlayerId === "a")!;
  const bSample = samples.find((s) => s.edgePlayerId === "b")!;
  assertAlmostEquals(aSample.qb_hits, 1, 1e-9);
  assertAlmostEquals(bSample.qb_hits, 1, 1e-9);
});

Deno.test("collectEdgeSamples reports tfl as 0 (sim does not emit TFL events)", () => {
  // Documented proxy gap: until the engine emits a tfl participant tag,
  // every EDGE sample reports 0 TFLs. The band check is expected to
  // surface this as a low-direction FAIL in the calibration report.
  const home = team("home", [edgeRuntime("home-edge", 60)]);
  const away = team("away", [edgeRuntime("away-edge", 50)]);
  const events: PlayEvent[] = [
    event({
      outcome: "rush",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: -3,
      tags: [],
    }),
  ];
  const [homeSample] = collectEdgeSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertEquals(homeSample.tfl, 0);
  assertEquals(homeSample.tfl_per_game, 0);
});

Deno.test("collectEdgeSamples exposes per-game rates identical to totals (one game per sample)", () => {
  const home = team("home", [edgeRuntime("home-edge", 60)]);
  const away = team("away", [edgeRuntime("away-edge", 50)]);
  const events: PlayEvent[] = [
    event({
      outcome: "sack",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: -7,
      tags: ["sack", "pressure"],
      participants: [
        { role: "pass_rush", playerId: "home-edge", tags: ["sack"] },
      ],
    }),
  ];
  const [homeSample] = collectEdgeSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertEquals(homeSample.games, 1);
  assertEquals(homeSample.sacks_per_game, homeSample.sacks);
  assertEquals(homeSample.qb_hits_per_game, homeSample.qb_hits);
});
