import { assertAlmostEquals, assertEquals } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { collectOtSamples } from "./ot-sample.ts";
import type { GameResult, PenaltyInfo, PlayEvent } from "../../events.ts";
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

function ot(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "OT",
    attributes: attrs({
      passBlocking: overall,
      runBlocking: overall,
      strength: overall,
      agility: overall,
      footballIq: overall,
    }),
  };
}

function team(teamId: string, tackles: PlayerRuntime[]): SimTeam {
  return {
    teamId,
    starters: tackles,
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

function penaltyOn(playerId: string, accepted = true): PenaltyInfo {
  return {
    type: "holding",
    phase: "post_snap",
    yardage: -10,
    automaticFirstDown: false,
    againstTeamId: "home",
    againstPlayerId: playerId,
    accepted,
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

Deno.test("collectOtSamples emits one sample per starting tackle per team", () => {
  const home = team("home", [ot("h-lt", 50), ot("h-rt", 50)]);
  const away = team("away", [ot("a-lt", 50), ot("a-rt", 50)]);
  const samples = collectOtSamples({ game: gameOf([]), home, away });
  assertEquals(samples.length, 4);
  const ids = samples.map((s) => s.otPlayerId).sort();
  assertEquals(ids, ["a-lt", "a-rt", "h-lt", "h-rt"]);
});

Deno.test("collectOtSamples skips a team with no starting tackles", () => {
  const home = team("home", [ot("h-lt", 50), ot("h-rt", 50)]);
  const away: SimTeam = { ...team("away", []), starters: [] };
  const samples = collectOtSamples({ game: gameOf([]), home, away });
  assertEquals(samples.length, 2);
  for (const s of samples) assertEquals(s.teamId, "home");
});

Deno.test("collectOtSamples tags each sample with OT overall", () => {
  const home = team("home", [
    {
      playerId: "h-lt",
      neutralBucket: "OT",
      attributes: attrs({
        passBlocking: 80,
        runBlocking: 70,
        strength: 60,
        agility: 50,
        footballIq: 40,
      }),
    },
  ]);
  const away = team("away", [ot("a-lt", 50)]);
  const [homeSample] = collectOtSamples({ game: gameOf([]), home, away });
  // (80 + 70 + 60 + 50 + 40) / 5 = 60
  assertAlmostEquals(homeSample.otOverall, 60);
});

Deno.test("collectOtSamples accumulates team dropbacks, sacks, rushes, and rush yards", () => {
  const home = team("home", [ot("h-lt", 50), ot("h-rt", 50)]);
  const away = team("away", [ot("a-lt", 50), ot("a-rt", 50)]);
  const events: PlayEvent[] = [
    event({ outcome: "pass_complete", offenseTeamId: "home", yardage: 10 }),
    event({ outcome: "pass_incomplete", offenseTeamId: "home", yardage: 0 }),
    event({ outcome: "sack", offenseTeamId: "home", yardage: -7 }),
    event({
      outcome: "rush",
      offenseTeamId: "home",
      yardage: 5,
      call: {
        concept: "inside_zone",
        personnel: "11",
        formation: "singleback",
        motion: "none",
      },
    }),
    event({
      outcome: "rush",
      offenseTeamId: "home",
      yardage: 3,
      call: {
        concept: "outside_zone",
        personnel: "11",
        formation: "singleback",
        motion: "none",
      },
    }),
    // Away team: one sack, one dropback. Isolated from home aggregation.
    event({ outcome: "pass_complete", offenseTeamId: "away", yardage: 4 }),
    event({ outcome: "sack", offenseTeamId: "away", yardage: -5 }),
  ];
  const samples = collectOtSamples({ game: gameOf(events), home, away });
  const homeSamples = samples.filter((s) => s.teamId === "home");
  const awaySamples = samples.filter((s) => s.teamId === "away");

  // Home team totals: dropbacks = 3 (2 pass + 1 sack), sacks = 1,
  // rushes = 2, rush yards = 8.
  for (const s of homeSamples) {
    assertEquals(s.team_dropbacks, 3);
    assertEquals(s.team_sacks_allowed, 1);
    assertEquals(s.team_rushes, 2);
    assertEquals(s.team_rush_yards, 8);
    assertAlmostEquals(s.team_sack_allowed_rate, 1 / 3, 1e-6);
    assertAlmostEquals(s.team_rush_ypc, 4);
  }
  for (const s of awaySamples) {
    assertEquals(s.team_dropbacks, 2);
    assertEquals(s.team_sacks_allowed, 1);
    assertAlmostEquals(s.team_sack_allowed_rate, 0.5);
  }
});

Deno.test("collectOtSamples shares team stats equally across both starting tackles", () => {
  const home = team("home", [ot("h-lt", 50), ot("h-rt", 50)]);
  const away = team("away", [ot("a-lt", 50), ot("a-rt", 50)]);
  const events: PlayEvent[] = [
    event({ outcome: "sack", offenseTeamId: "home", yardage: -7 }),
    event({ outcome: "pass_complete", offenseTeamId: "home", yardage: 8 }),
  ];
  const samples = collectOtSamples({ game: gameOf(events), home, away });
  const homeSamples = samples.filter((s) => s.teamId === "home");
  assertEquals(homeSamples.length, 2);
  // Both tackles see the same team-level proxy rate.
  assertEquals(
    homeSamples[0].team_sack_allowed_rate,
    homeSamples[1].team_sack_allowed_rate,
  );
});

Deno.test("collectOtSamples attributes penalties only to the specific tackle via againstPlayerId", () => {
  const home = team("home", [ot("h-lt", 50), ot("h-rt", 50)]);
  const away = team("away", [ot("a-lt", 50), ot("a-rt", 50)]);
  const events: PlayEvent[] = [
    event({
      outcome: "penalty",
      offenseTeamId: "home",
      penalty: penaltyOn("h-lt"),
    }),
    event({
      outcome: "penalty",
      offenseTeamId: "home",
      penalty: penaltyOn("h-lt"),
    }),
    event({
      outcome: "penalty",
      offenseTeamId: "home",
      penalty: penaltyOn("h-rt"),
    }),
  ];
  const samples = collectOtSamples({ game: gameOf(events), home, away });
  const lt = samples.find((s) => s.otPlayerId === "h-lt")!;
  const rt = samples.find((s) => s.otPlayerId === "h-rt")!;
  assertEquals(lt.penalties, 2);
  assertEquals(rt.penalties, 1);
  assertEquals(lt.penalties_per_game, 2);
  assertEquals(rt.penalties_per_game, 1);
});

Deno.test("collectOtSamples ignores declined penalties", () => {
  const home = team("home", [ot("h-lt", 50), ot("h-rt", 50)]);
  const away = team("away", [ot("a-lt", 50), ot("a-rt", 50)]);
  const events: PlayEvent[] = [
    event({
      outcome: "penalty",
      offenseTeamId: "home",
      penalty: penaltyOn("h-lt", false), // declined
    }),
    event({
      outcome: "penalty",
      offenseTeamId: "home",
      penalty: penaltyOn("h-lt", true),
    }),
  ];
  const samples = collectOtSamples({ game: gameOf(events), home, away });
  const lt = samples.find((s) => s.otPlayerId === "h-lt")!;
  assertEquals(lt.penalties, 1);
});

Deno.test("collectOtSamples handles zero-dropback games without divide-by-zero", () => {
  const home = team("home", [ot("h-lt", 50), ot("h-rt", 50)]);
  const away = team("away", [ot("a-lt", 50), ot("a-rt", 50)]);
  const [sample] = collectOtSamples({ game: gameOf([]), home, away });
  assertEquals(sample.team_sack_allowed_rate, 0);
  assertEquals(sample.team_rush_ypc, 0);
  assertEquals(sample.penalties_per_game, 0);
  assertEquals(sample.starts_per_season, 1);
});

Deno.test("collectOtSamples treats run-concept TDs as rushes for team_rush_ypc proxy", () => {
  const home = team("home", [ot("h-lt", 50), ot("h-rt", 50)]);
  const away = team("away", [ot("a-lt", 50), ot("a-rt", 50)]);
  const events: PlayEvent[] = [
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
  const [homeSample] = collectOtSamples({ game: gameOf(events), home, away });
  assertEquals(homeSample.team_rushes, 1);
  assertEquals(homeSample.team_rush_yards, 4);
  assertEquals(homeSample.team_dropbacks, 1); // pass-concept TD counts as a dropback
});
