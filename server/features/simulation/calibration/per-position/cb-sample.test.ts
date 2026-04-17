import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { collectCbSamples } from "./cb-sample.ts";
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

function cb(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "CB",
    attributes: attrs({
      manCoverage: overall,
      zoneCoverage: overall,
      speed: overall,
      agility: overall,
    }),
  };
}

function teamOf(
  teamId: string,
  starters: PlayerRuntime[],
): SimTeam {
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

Deno.test("collectCbSamples emits one sample per CB per team", () => {
  const home = teamOf("home", [cb("h-cb1", 50), cb("h-cb2", 50)]);
  const away = teamOf("away", [cb("a-cb1", 50)]);
  const samples = collectCbSamples({ game: gameOf([]), home, away });
  assertEquals(samples.length, 3);
  assertEquals(samples.map((s) => s.cbPlayerId).sort(), [
    "a-cb1",
    "h-cb1",
    "h-cb2",
  ]);
});

Deno.test("collectCbSamples skips a team with no CB starters", () => {
  const home = teamOf("home", [cb("h-cb1", 50)]);
  const away = teamOf("away", []);
  const samples = collectCbSamples({ game: gameOf([]), home, away });
  assertEquals(samples.length, 1);
  assertEquals(samples[0].cbPlayerId, "h-cb1");
});

Deno.test("collectCbSamples tags each sample with the CB's overall", () => {
  const home = teamOf("home", [
    {
      playerId: "h-cb1",
      neutralBucket: "CB",
      attributes: attrs({
        manCoverage: 60,
        zoneCoverage: 70,
        speed: 80,
        agility: 50,
      }),
    },
  ]);
  const away = teamOf("away", [cb("a-cb1", 50)]);
  const [homeSample] = collectCbSamples({ game: gameOf([]), home, away });
  // (60 + 70 + 80 + 50) / 4 = 65
  assertAlmostEquals(homeSample.cbOverall, 65, 0.01);
});

Deno.test("collectCbSamples allocates team-level pass-defense totals by coverage-attr share", () => {
  // Two CBs, one twice as good at coverage as the other. The weaker
  // CB should get 1/3 of each team-level target/completion/yard, the
  // stronger CB 2/3.
  const weak = cb("weak", 30);
  const strong = cb("strong", 60);
  const home = teamOf("home", [weak, strong]);
  const away = teamOf("away", [cb("a-cb1", 50)]);

  // 9 passes faced by home defense: 6 complete (10 yds each), 3 incomplete.
  const events: PlayEvent[] = [];
  for (let i = 0; i < 6; i++) {
    events.push(event({
      outcome: "pass_complete",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: 10,
    }));
  }
  for (let i = 0; i < 3; i++) {
    events.push(event({
      outcome: "pass_incomplete",
      offenseTeamId: "away",
      defenseTeamId: "home",
    }));
  }

  const samples = collectCbSamples({ game: gameOf(events), home, away });
  const weakSample = samples.find((s) => s.cbPlayerId === "weak")!;
  const strongSample = samples.find((s) => s.cbPlayerId === "strong")!;

  // Shares: weak = 30/(30+60) = 1/3, strong = 2/3.
  assertAlmostEquals(weakSample.targets, 9 * (1 / 3), 1e-6);
  assertAlmostEquals(strongSample.targets, 9 * (2 / 3), 1e-6);
  assertAlmostEquals(weakSample.completions_allowed, 6 * (1 / 3), 1e-6);
  assertAlmostEquals(strongSample.completions_allowed, 6 * (2 / 3), 1e-6);
  assertAlmostEquals(weakSample.yards_allowed, 60 * (1 / 3), 1e-6);
  assertAlmostEquals(strongSample.yards_allowed, 60 * (2 / 3), 1e-6);
  // PBU proxy splits incompletions by share.
  assertAlmostEquals(weakSample.pbus, 3 * (1 / 3), 1e-6);
  assertAlmostEquals(strongSample.pbus, 3 * (2 / 3), 1e-6);
  // Completion % allowed and YPT are share-invariant — both CBs see
  // the same rate when allocation is proportional.
  assertAlmostEquals(weakSample.completion_allowed_pct, 6 / 9, 1e-6);
  assertAlmostEquals(strongSample.completion_allowed_pct, 6 / 9, 1e-6);
  assertAlmostEquals(weakSample.yards_per_target_allowed, 60 / 9, 1e-6);
  assertAlmostEquals(strongSample.yards_per_target_allowed, 60 / 9, 1e-6);
});

Deno.test("collectCbSamples credits interceptions directly to the tagged defender", () => {
  const home = teamOf("home", [cb("h-cb1", 50), cb("h-cb2", 50)]);
  const away = teamOf("away", [cb("a-cb1", 50)]);
  const events: PlayEvent[] = [
    event({
      outcome: "interception",
      offenseTeamId: "away",
      defenseTeamId: "home",
      participants: [
        { role: "route_coverage", playerId: "h-cb2", tags: ["interception"] },
      ],
    }),
    event({
      outcome: "interception",
      offenseTeamId: "away",
      defenseTeamId: "home",
      participants: [
        { role: "route_coverage", playerId: "h-cb2", tags: ["interception"] },
      ],
    }),
  ];
  const samples = collectCbSamples({ game: gameOf(events), home, away });
  const cb1 = samples.find((s) => s.cbPlayerId === "h-cb1")!;
  const cb2 = samples.find((s) => s.cbPlayerId === "h-cb2")!;
  assertEquals(cb1.interceptions, 0);
  assertEquals(cb2.interceptions, 2);
  // An interception still counts as a target against the defense —
  // shared evenly across both CBs (same coverage attrs).
  assertAlmostEquals(cb1.targets, 1, 1e-6);
  assertAlmostEquals(cb2.targets, 1, 1e-6);
});

Deno.test("collectCbSamples counts pass-concept TDs as completions against the defense", () => {
  const home = teamOf("home", [cb("h-cb1", 50)]);
  const away = teamOf("away", [cb("a-cb1", 50)]);
  const events: PlayEvent[] = [
    event({
      outcome: "touchdown",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: 40,
      call: {
        concept: "deep_shot",
        personnel: "11",
        formation: "shotgun",
        motion: "none",
      },
    }),
    event({
      outcome: "touchdown",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: 2,
      call: {
        concept: "inside_zone",
        personnel: "11",
        formation: "singleback",
        motion: "none",
      },
    }),
  ];
  const [sample] = collectCbSamples({ game: gameOf(events), home, away });
  // Pass-concept TD counts as a target + completion + yards; rush TD
  // is ignored.
  assertAlmostEquals(sample.targets, 1, 1e-6);
  assertAlmostEquals(sample.completions_allowed, 1, 1e-6);
  assertAlmostEquals(sample.yards_allowed, 40, 1e-6);
});

Deno.test("collectCbSamples isolates defense by team", () => {
  const home = teamOf("home", [cb("h-cb1", 50)]);
  const away = teamOf("away", [cb("a-cb1", 50)]);
  const events: PlayEvent[] = [
    event({
      outcome: "pass_complete",
      offenseTeamId: "home",
      defenseTeamId: "away",
      yardage: 10,
    }),
    event({
      outcome: "pass_complete",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: 20,
    }),
  ];
  const [homeSample, awaySample] = collectCbSamples({
    game: gameOf(events),
    home,
    away,
  });
  assertAlmostEquals(homeSample.targets, 1);
  assertAlmostEquals(homeSample.yards_allowed, 20);
  assertAlmostEquals(awaySample.targets, 1);
  assertAlmostEquals(awaySample.yards_allowed, 10);
});

Deno.test("collectCbSamples handles zero-target games without divide-by-zero", () => {
  const home = teamOf("home", [cb("h-cb1", 50)]);
  const away = teamOf("away", [cb("a-cb1", 50)]);
  const [sample] = collectCbSamples({ game: gameOf([]), home, away });
  assertEquals(sample.targets, 0);
  assertEquals(sample.completion_allowed_pct, 0);
  assertEquals(sample.yards_per_target_allowed, 0);
  assertEquals(sample.pbu_rate, 0);
  assertEquals(sample.pbus_per_game, 0);
  assertEquals(sample.ints_per_game, 0);
});

Deno.test("collectCbSamples falls back to even share when CB coverage attrs sum to zero", () => {
  const zeroCb = (id: string): PlayerRuntime => ({
    playerId: id,
    neutralBucket: "CB",
    attributes: attrs({
      manCoverage: 0,
      zoneCoverage: 0,
      speed: 0,
      agility: 0,
    }),
  });
  const home = teamOf("home", [zeroCb("h-cb1"), zeroCb("h-cb2")]);
  const away = teamOf("away", [cb("a-cb1", 50)]);
  const events: PlayEvent[] = [
    event({
      outcome: "pass_complete",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: 10,
    }),
    event({
      outcome: "pass_complete",
      offenseTeamId: "away",
      defenseTeamId: "home",
      yardage: 10,
    }),
  ];
  const samples = collectCbSamples({ game: gameOf(events), home, away });
  const homeSamples = samples.filter((s) => s.teamId === "home");
  assertEquals(homeSamples.length, 2);
  for (const s of homeSamples) {
    assertAlmostEquals(s.targets, 1, 1e-6);
    assertAlmostEquals(s.yards_allowed, 10, 1e-6);
  }
});
