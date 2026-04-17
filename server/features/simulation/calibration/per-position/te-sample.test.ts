import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { collectTeSamples } from "./te-sample.ts";
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

function te(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "TE",
    attributes: attrs({
      routeRunning: overall,
      catching: overall,
      runBlocking: overall,
      passBlocking: overall,
      speed: overall,
    }),
  };
}

function team(teamId: string, starterTe: PlayerRuntime): SimTeam {
  return {
    teamId,
    starters: [starterTe],
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

Deno.test("collectTeSamples returns one sample per team with a starter TE", () => {
  const home = team("home", te("home-te", 50));
  const away = team("away", te("away-te", 50));
  const samples = collectTeSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(samples.length, 2);
  assertEquals(samples[0].teamId, "home");
  assertEquals(samples[0].tePlayerId, "home-te");
  assertEquals(samples[1].teamId, "away");
});

Deno.test("collectTeSamples skips a team with no starter TE", () => {
  const home = team("home", te("home-te", 50));
  const away: SimTeam = { ...team("away", te("away-te", 50)), starters: [] };
  const samples = collectTeSamples({
    game: gameOf([]),
    home,
    away,
  });
  assertEquals(samples.length, 1);
  assertEquals(samples[0].teamId, "home");
});

Deno.test("collectTeSamples tags sample with TE overall (mean of five signature attrs)", () => {
  const home = team(
    "home",
    {
      playerId: "home-te",
      neutralBucket: "TE",
      attributes: attrs({
        routeRunning: 60,
        catching: 70,
        runBlocking: 80,
        passBlocking: 50,
        speed: 65,
      }),
    },
  );
  const away = team("away", te("away-te", 50));
  const [homeSample] = collectTeSamples({
    game: gameOf([]),
    home,
    away,
  });
  // (60 + 70 + 80 + 50 + 65) / 5 = 65
  assertAlmostEquals(homeSample.teOverall, 65, 0.01);
});

Deno.test("collectTeSamples accumulates target/reception events tagged on the TE", () => {
  const home = team("home", te("home-te", 50));
  const away = team("away", te("away-te", 50));
  const events: PlayEvent[] = [
    // Reception #1 — 10 yd completion
    event({
      outcome: "pass_complete",
      offenseTeamId: "home",
      yardage: 10,
      participants: [
        { role: "route_coverage", playerId: "home-te", tags: ["target", "reception"] },
      ],
    }),
    // Reception #2 — 15 yd completion
    event({
      outcome: "pass_complete",
      offenseTeamId: "home",
      yardage: 15,
      participants: [
        { role: "route_coverage", playerId: "home-te", tags: ["target", "reception"] },
      ],
    }),
    // Pass to another receiver — TE not involved
    event({
      outcome: "pass_complete",
      offenseTeamId: "home",
      yardage: 20,
      participants: [
        { role: "route_coverage", playerId: "home-wr", tags: ["target", "reception"] },
      ],
    }),
    // TD thrown to the TE — counts as target + reception + rec TD
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
      participants: [
        { role: "route_coverage", playerId: "home-te", tags: ["target", "reception"] },
      ],
    }),
  ];
  const [homeSample] = collectTeSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertEquals(homeSample.targets, 3);
  assertEquals(homeSample.receptions, 3);
  assertEquals(homeSample.rec_yards, 50);
  assertEquals(homeSample.rec_tds, 1);
  assertAlmostEquals(homeSample.catch_rate, 1);
  assertAlmostEquals(homeSample.yards_per_reception, 50 / 3, 1e-6);
  assertAlmostEquals(homeSample.yards_per_target, 50 / 3, 1e-6);
  assertAlmostEquals(homeSample.td_rate, 1 / 3, 1e-6);
  assertAlmostEquals(homeSample.yards_per_game, 50);
});

Deno.test("collectTeSamples skips run-concept TDs — they belong to the ball carrier, not the TE", () => {
  const home = team("home", te("home-te", 50));
  const away = team("away", te("away-te", 50));
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
      // Even if the TE is tagged on the play (they blocked), a run-
      // concept TD must not be credited to the receiving line.
      participants: [
        { role: "run_block", playerId: "home-te", tags: ["target"] },
      ],
    }),
  ];
  const [homeSample] = collectTeSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertEquals(homeSample.targets, 0);
  assertEquals(homeSample.receptions, 0);
  assertEquals(homeSample.rec_tds, 0);
});

Deno.test("collectTeSamples counts incomplete + INT pass attempts as targets when tagged", () => {
  const home = team("home", te("home-te", 50));
  const away = team("away", te("away-te", 50));
  const events: PlayEvent[] = [
    event({
      outcome: "pass_complete",
      offenseTeamId: "home",
      yardage: 12,
      participants: [
        { role: "route_coverage", playerId: "home-te", tags: ["target", "reception"] },
      ],
    }),
    event({
      outcome: "pass_incomplete",
      offenseTeamId: "home",
      yardage: 0,
      participants: [
        { role: "route_coverage", playerId: "home-te", tags: ["target"] },
      ],
    }),
    event({
      outcome: "interception",
      offenseTeamId: "home",
      yardage: 0,
      participants: [
        { role: "route_coverage", playerId: "home-te", tags: ["target"] },
      ],
    }),
  ];
  const [homeSample] = collectTeSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertEquals(homeSample.targets, 3);
  assertEquals(homeSample.receptions, 1);
  assertEquals(homeSample.rec_yards, 12);
  assertAlmostEquals(homeSample.catch_rate, 1 / 3, 1e-6);
  assertAlmostEquals(homeSample.yards_per_target, 12 / 3, 1e-6);
});

Deno.test("collectTeSamples isolates offense by team", () => {
  const home = team("home", te("home-te", 50));
  const away = team("away", te("away-te", 50));
  const events: PlayEvent[] = [
    event({
      outcome: "pass_complete",
      offenseTeamId: "home",
      yardage: 8,
      participants: [
        { role: "route_coverage", playerId: "home-te", tags: ["target", "reception"] },
      ],
    }),
    event({
      outcome: "pass_complete",
      offenseTeamId: "away",
      yardage: 14,
      participants: [
        { role: "route_coverage", playerId: "away-te", tags: ["target", "reception"] },
      ],
    }),
  ];
  const [homeSample, awaySample] = collectTeSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertEquals(homeSample.rec_yards, 8);
  assertEquals(awaySample.rec_yards, 14);
});

Deno.test("collectTeSamples ignores events where the TE is not the tagged target", () => {
  const home = team("home", te("home-te", 50));
  const away = team("away", te("away-te", 50));
  const events: PlayEvent[] = [
    // No participants at all — can't attribute.
    event({ outcome: "pass_complete", offenseTeamId: "home", yardage: 30 }),
    // TE is on the field (run block) but did NOT run the route.
    event({
      outcome: "pass_complete",
      offenseTeamId: "home",
      yardage: 12,
      participants: [
        { role: "route_coverage", playerId: "home-wr", tags: ["target", "reception"] },
        { role: "pass_block", playerId: "home-te", tags: [] },
      ],
    }),
  ];
  const [homeSample] = collectTeSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertEquals(homeSample.targets, 0);
  assertEquals(homeSample.receptions, 0);
});

Deno.test("collectTeSamples handles zero-target games without divide-by-zero", () => {
  const home = team("home", te("home-te", 50));
  const away = team("away", te("away-te", 50));
  const [sample] = collectTeSamples({
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
