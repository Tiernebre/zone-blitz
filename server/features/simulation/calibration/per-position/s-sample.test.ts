import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { collectSSamples } from "./s-sample.ts";
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

function safety(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "S",
    attributes: attrs({
      zoneCoverage: overall,
      manCoverage: overall,
      speed: overall,
      tackling: overall,
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

Deno.test("collectSSamples emits one sample per S starter on each team", () => {
  const home = team("home", [safety("home-s1", 50), safety("home-s2", 60)]);
  const away = team("away", [safety("away-s1", 50), safety("away-s2", 50)]);
  const samples = collectSSamples({ game: gameOf([]), home, away });
  assertEquals(samples.length, 4);
  assertEquals(samples[0].teamId, "home");
  assertEquals(samples[0].safetyPlayerId, "home-s1");
  assertEquals(samples[1].safetyPlayerId, "home-s2");
  assertEquals(samples[2].teamId, "away");
});

Deno.test("collectSSamples skips a team with no S starters", () => {
  const home = team("home", [safety("home-s1", 50)]);
  const away = team("away", []);
  const samples = collectSSamples({ game: gameOf([]), home, away });
  assertEquals(samples.length, 1);
  assertEquals(samples[0].teamId, "home");
});

Deno.test("collectSSamples tags sample with S overall (mean of the five signature attrs)", () => {
  const custom: PlayerRuntime = {
    playerId: "home-s1",
    neutralBucket: "S",
    attributes: attrs({
      zoneCoverage: 60,
      manCoverage: 70,
      speed: 80,
      tackling: 50,
      anticipation: 60,
    }),
  };
  const home = team("home", [custom]);
  const away = team("away", [safety("away-s1", 50)]);
  const [homeSample] = collectSSamples({ game: gameOf([]), home, away });
  // (60 + 70 + 80 + 50 + 60) / 5 = 64
  assertAlmostEquals(homeSample.sOverall, 64, 1e-6);
});

Deno.test("collectSSamples team-allocates tackles/INTs/PBUs/FFs across S starters", () => {
  const home = team("home", [safety("home-s1", 50), safety("home-s2", 50)]);
  const away = team("away", [safety("away-s1", 50)]);
  const events: PlayEvent[] = [
    // 10 rushes against home defense → 10 team tackles
    ...Array.from({ length: 10 }, () =>
      event({
        outcome: "rush",
        offenseTeamId: "away",
        defenseTeamId: "home",
      })),
    // 5 completions → 5 more team tackles
    ...Array.from({ length: 5 }, () =>
      event({
        outcome: "pass_complete",
        offenseTeamId: "away",
        defenseTeamId: "home",
      })),
    // 10 incompletes → 10 * 0.4 = 4 PBUs credited to team
    ...Array.from({ length: 10 }, () =>
      event({
        outcome: "pass_incomplete",
        offenseTeamId: "away",
        defenseTeamId: "home",
      })),
    // 2 INTs, 1 fumble (also counts as a tackle)
    event({
      outcome: "interception",
      offenseTeamId: "away",
      defenseTeamId: "home",
    }),
    event({
      outcome: "interception",
      offenseTeamId: "away",
      defenseTeamId: "home",
    }),
    event({
      outcome: "fumble",
      offenseTeamId: "away",
      defenseTeamId: "home",
    }),
  ];
  const samples = collectSSamples({ game: gameOf(events), home, away });
  const homeSamples = samples.filter((s) => s.teamId === "home");
  assertEquals(homeSamples.length, 2);

  // Team totals: tackles = 15 + 1 = 16; INTs = 2; PBUs = 4; FFs = 1.
  // Secondary share = 0.45; each of the 2 S starters gets half.
  const SECONDARY = 0.45;
  assertAlmostEquals(homeSamples[0].tackles_per_game, (16 * SECONDARY) / 2);
  assertAlmostEquals(homeSamples[0].int_rate, (2 * SECONDARY) / 2);
  assertAlmostEquals(homeSamples[0].pbu_rate, (4 * SECONDARY) / 2);
  assertAlmostEquals(homeSamples[0].forced_fumble_rate, (1 * SECONDARY) / 2);
  // Both home safeties get the same allocated rates.
  assertAlmostEquals(
    homeSamples[0].tackles_per_game,
    homeSamples[1].tackles_per_game,
  );
});

Deno.test("collectSSamples isolates defense by team", () => {
  const home = team("home", [safety("home-s1", 50)]);
  const away = team("away", [safety("away-s1", 50)]);
  const events: PlayEvent[] = [
    event({
      outcome: "interception",
      offenseTeamId: "away",
      defenseTeamId: "home",
    }),
    event({
      outcome: "rush",
      offenseTeamId: "home",
      defenseTeamId: "away",
    }),
  ];
  const samples = collectSSamples({ game: gameOf(events), home, away });
  const home1 = samples.find((s) => s.teamId === "home")!;
  const away1 = samples.find((s) => s.teamId === "away")!;
  // home defense recorded the INT, away defense recorded the tackle
  assertAlmostEquals(home1.int_rate, (1 * 0.45) / 1);
  assertAlmostEquals(home1.tackles_per_game, 0);
  assertAlmostEquals(away1.tackles_per_game, (1 * 0.45) / 1);
  assertAlmostEquals(away1.int_rate, 0);
});

Deno.test("collectSSamples does not credit safeties for sacks or offensive touchdowns", () => {
  const home = team("home", [safety("home-s1", 50)]);
  const away = team("away", [safety("away-s1", 50)]);
  const events: PlayEvent[] = [
    event({
      outcome: "sack",
      offenseTeamId: "away",
      defenseTeamId: "home",
    }),
    event({
      outcome: "touchdown",
      offenseTeamId: "away",
      defenseTeamId: "home",
    }),
  ];
  const [homeSample] = collectSSamples({ game: gameOf(events), home, away });
  assertEquals(homeSample.tackles_per_game, 0);
  assertEquals(homeSample.pbu_rate, 0);
  assertEquals(homeSample.int_rate, 0);
  assertEquals(homeSample.forced_fumble_rate, 0);
});

Deno.test("collectSSamples returns zero rates on an empty game without divide-by-zero", () => {
  const home = team("home", [safety("home-s1", 50)]);
  const away = team("away", [safety("away-s1", 50)]);
  const samples = collectSSamples({ game: gameOf([]), home, away });
  assertEquals(samples.length, 2);
  for (const s of samples) {
    assertEquals(s.tackles_per_game, 0);
    assertEquals(s.int_rate, 0);
    assertEquals(s.pbu_rate, 0);
    assertEquals(s.forced_fumble_rate, 0);
  }
});
