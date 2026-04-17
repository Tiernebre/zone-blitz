import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { collectIolSamples } from "./iol-sample.ts";
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

function lineman(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "IOL",
    attributes: attrs({
      passBlocking: overall,
      runBlocking: overall,
      strength: overall,
      footballIq: overall,
    }),
  };
}

function otherStarter(id: string, bucket: "QB" | "OT"): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: bucket,
    attributes: attrs(),
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

Deno.test("collectIolSamples emits one sample per IOL starter per team", () => {
  const home = team("home", [
    otherStarter("qb1", "QB"),
    lineman("c1", 50),
    lineman("lg1", 50),
    lineman("rg1", 50),
  ]);
  const away = team("away", [
    otherStarter("qb2", "QB"),
    lineman("c2", 50),
    lineman("lg2", 50),
    lineman("rg2", 50),
  ]);
  const samples = collectIolSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(samples.length, 6);
  assertEquals(samples.filter((s) => s.teamId === "home").length, 3);
  assertEquals(samples.filter((s) => s.teamId === "away").length, 3);
});

Deno.test("collectIolSamples skips teams without IOL starters", () => {
  const home = team("home", [lineman("c1", 50)]);
  const away = team("away", [
    otherStarter("qb2", "QB"),
    otherStarter("ot2", "OT"),
  ]);
  const samples = collectIolSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(samples.length, 1);
  assertEquals(samples[0].teamId, "home");
});

Deno.test("collectIolSamples tags each sample with IOL overall (mean of four signature attrs)", () => {
  const home = team(
    "home",
    [
      {
        playerId: "c1",
        neutralBucket: "IOL",
        attributes: attrs({
          passBlocking: 60,
          runBlocking: 70,
          strength: 80,
          footballIq: 50,
        }),
      },
    ],
  );
  const away = team("away", [lineman("c2", 50)]);
  const [home_sample] = collectIolSamples({
    game: gameOf([]),
    home,
    away,
  });
  // (60 + 70 + 80 + 50) / 4 = 65
  assertAlmostEquals(home_sample.iolOverall, 65, 1e-6);
});

Deno.test("collectIolSamples computes team_sack_allowed_rate across all IOL starters on a team", () => {
  const home = team("home", [lineman("c1", 50), lineman("lg1", 50)]);
  const away = team("away", [lineman("c2", 50)]);
  const events: PlayEvent[] = [
    event({ outcome: "pass_complete", offenseTeamId: "home" }),
    event({ outcome: "pass_incomplete", offenseTeamId: "home" }),
    event({ outcome: "pass_incomplete", offenseTeamId: "home" }),
    event({ outcome: "sack", offenseTeamId: "home", yardage: -7 }),
  ];
  const samples = collectIolSamples({
    game: gameOf(events),
    home,
    away,
  });
  const homeSamples = samples.filter((s) => s.teamId === "home");
  assertEquals(homeSamples.length, 2);
  for (const s of homeSamples) {
    assertEquals(s.team_dropbacks, 4);
    assertEquals(s.team_sacks, 1);
    assertAlmostEquals(s.team_sack_allowed_rate, 0.25, 1e-6);
  }
});

Deno.test("collectIolSamples counts interior rushes for stuff-rate denominator", () => {
  const home = team("home", [lineman("c1", 50)]);
  const away = team("away", [lineman("c2", 50)]);
  const events: PlayEvent[] = [
    // Three interior runs, two of them stuffs.
    event({
      outcome: "rush",
      offenseTeamId: "home",
      yardage: 5,
      call: {
        concept: "inside_zone",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
    }),
    event({
      outcome: "rush",
      offenseTeamId: "home",
      yardage: 0,
      call: {
        concept: "power",
        personnel: "12",
        formation: "singleback",
        motion: "none",
      },
    }),
    event({
      outcome: "rush",
      offenseTeamId: "home",
      yardage: -2,
      call: {
        concept: "counter",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
    }),
    // Outside-zone run — does NOT count toward interior stuff rate.
    event({
      outcome: "rush",
      offenseTeamId: "home",
      yardage: 0,
      call: {
        concept: "outside_zone",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
    }),
  ];
  const [homeSample] = collectIolSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertEquals(homeSample.team_interior_runs, 3);
  assertEquals(homeSample.team_interior_stuffs, 2);
  assertAlmostEquals(homeSample.team_stuff_rate_inside, 2 / 3, 1e-6);
});

Deno.test("collectIolSamples attributes per-player penalties by againstPlayerId", () => {
  const home = team("home", [lineman("c1", 50), lineman("lg1", 50)]);
  const away = team("away", [lineman("c2", 50)]);
  const events: PlayEvent[] = [
    {
      ...event({ outcome: "penalty", offenseTeamId: "home" }),
      penalty: {
        type: "holding",
        phase: "post_snap",
        yardage: 10,
        automaticFirstDown: false,
        againstTeamId: "home",
        againstPlayerId: "c1",
        accepted: true,
      },
    },
    {
      ...event({ outcome: "penalty", offenseTeamId: "home" }),
      penalty: {
        type: "false_start",
        phase: "pre_snap",
        yardage: 5,
        automaticFirstDown: false,
        againstTeamId: "home",
        againstPlayerId: "c1",
        accepted: true,
      },
    },
    {
      ...event({ outcome: "penalty", offenseTeamId: "home" }),
      penalty: {
        type: "holding",
        phase: "post_snap",
        yardage: 10,
        automaticFirstDown: false,
        againstTeamId: "home",
        againstPlayerId: "lg1",
        accepted: true,
      },
    },
  ];
  const samples = collectIolSamples({
    game: gameOf(events),
    home,
    away,
  });
  const c1 = samples.find((s) => s.iolPlayerId === "c1")!;
  const lg1 = samples.find((s) => s.iolPlayerId === "lg1")!;
  assertEquals(c1.penalties, 2);
  assertEquals(c1.penalties_per_game, 2);
  assertEquals(lg1.penalties, 1);
});

Deno.test("collectIolSamples treats starts_per_season as 1 per game-sample", () => {
  const home = team("home", [lineman("c1", 50)]);
  const away = team("away", [lineman("c2", 50)]);
  const [homeSample] = collectIolSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(homeSample.starts_per_season, 1);
});

Deno.test("collectIolSamples isolates events by offenseTeamId", () => {
  const home = team("home", [lineman("c1", 50)]);
  const away = team("away", [lineman("c2", 50)]);
  const events: PlayEvent[] = [
    event({ outcome: "sack", offenseTeamId: "home", yardage: -5 }),
    event({ outcome: "pass_complete", offenseTeamId: "home" }),
    event({ outcome: "pass_incomplete", offenseTeamId: "away" }),
  ];
  const samples = collectIolSamples({
    game: gameOf(events),
    home,
    away,
  });
  const homeSample = samples.find((s) => s.teamId === "home")!;
  const awaySample = samples.find((s) => s.teamId === "away")!;
  assertEquals(homeSample.team_sacks, 1);
  assertEquals(homeSample.team_dropbacks, 2);
  assertEquals(awaySample.team_sacks, 0);
  assertEquals(awaySample.team_dropbacks, 1);
});

Deno.test("collectIolSamples handles zero-play games without divide-by-zero", () => {
  const home = team("home", [lineman("c1", 50)]);
  const away = team("away", [lineman("c2", 50)]);
  const [sample] = collectIolSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(sample.team_sack_allowed_rate, 0);
  assertEquals(sample.team_stuff_rate_inside, 0);
  assertEquals(sample.penalties_per_game, 0);
});
