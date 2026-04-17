import { assertEquals, assertStringIncludes } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { formatOtCalibrationReport, runOtCalibration } from "./ot-harness.ts";
import type { GameResult, PlayEvent } from "../../events.ts";
import type { SimTeam } from "../../simulate-game.ts";
import type { PlayerRuntime } from "../../resolve-play.ts";
import type { CalibrationLeague } from "../generate-calibration-league.ts";

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

// Five-band OT fixture with monotonic means on all three metrics. Built
// to match DEFAULT_EXPECTED_BAND: 30->replacement, 50->average, 70->elite.
function bandJson(): string {
  const band = (sackRate: number, rushYpc: number, pen: number) => ({
    n: 20,
    metrics: {
      team_sack_allowed_rate: { n: 20, mean: sackRate, sd: 0.01 },
      team_rush_ypc: { n: 20, mean: rushYpc, sd: 0.2 },
      penalties_per_game: { n: 20, mean: pen, sd: 0.1 },
      starts_per_season: { n: 20, mean: 14, sd: 1 },
    },
  });
  return JSON.stringify({
    position: "OT",
    seasons: [2020, 2021, 2022, 2023, 2024],
    ranking_stat: "composite proxy",
    bands: {
      elite: band(0.05, 4.7, 0.2),
      good: band(0.055, 4.35, 0.29),
      average: band(0.065, 4.05, 0.33),
      weak: band(0.075, 3.85, 0.42),
      replacement: band(0.086, 3.75, 0.63),
    },
  });
}

// Stubs a game whose team-level sack rate and rush YPC mirror the
// expected-band means for each side's OT overall.
function makeGame(
  gameId: string,
  homeTeamId: string,
  awayTeamId: string,
  statsByTeam: Record<
    string,
    { sackRate: number; rushYpc: number; penaltyCount: number }
  >,
): GameResult {
  const events: PlayEvent[] = [];
  for (
    const [offenseTeamId, s] of Object.entries(statsByTeam)
  ) {
    const defenseTeamId = offenseTeamId === homeTeamId
      ? awayTeamId
      : homeTeamId;
    // 200 dropbacks at the given sack rate to minimize rounding drift
    // between the requested rate and the int sack count.
    const dropbacks = 200;
    const sacks = Math.round(dropbacks * s.sackRate);
    const passes = dropbacks - sacks;
    for (let i = 0; i < passes; i++) {
      events.push({
        gameId,
        driveIndex: 0,
        playIndex: events.length,
        quarter: 1,
        clock: "15:00",
        situation: { down: 1, distance: 10, yardLine: 25 },
        offenseTeamId,
        defenseTeamId,
        call: {
          concept: "dropback",
          personnel: "11",
          formation: "shotgun",
          motion: "none",
        },
        coverage: { front: "4-3", coverage: "cover_2", pressure: "four_man" },
        participants: [],
        outcome: "pass_complete",
        yardage: 7,
        tags: [],
      });
    }
    for (let i = 0; i < sacks; i++) {
      events.push({
        gameId,
        driveIndex: 0,
        playIndex: events.length,
        quarter: 1,
        clock: "15:00",
        situation: { down: 1, distance: 10, yardLine: 25 },
        offenseTeamId,
        defenseTeamId,
        call: {
          concept: "dropback",
          personnel: "11",
          formation: "shotgun",
          motion: "none",
        },
        coverage: { front: "4-3", coverage: "cover_2", pressure: "four_man" },
        participants: [],
        outcome: "sack",
        yardage: -7,
        tags: [],
      });
    }
    // 20 rushes at the given YPC.
    const rushes = 20;
    const rushYards = Math.round(rushes * s.rushYpc);
    for (let i = 0; i < rushes; i++) {
      events.push({
        gameId,
        driveIndex: 0,
        playIndex: events.length,
        quarter: 1,
        clock: "15:00",
        situation: { down: 1, distance: 10, yardLine: 25 },
        offenseTeamId,
        defenseTeamId,
        call: {
          concept: "inside_zone",
          personnel: "11",
          formation: "singleback",
          motion: "none",
        },
        coverage: { front: "4-3", coverage: "cover_2", pressure: "four_man" },
        participants: [],
        outcome: "rush",
        yardage: i === 0 ? rushYards : 0,
        tags: [],
      });
    }
  }
  return {
    gameId,
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

Deno.test("runOtCalibration buckets tackles by overall and returns a populated report", () => {
  const overallByTeam: Record<string, number> = {
    t30: 30,
    t40: 40,
    t50: 50,
    t60: 60,
    t70: 70,
    t80: 80,
  };
  // Map each overall onto the target band's team-level means so the
  // bucket should land in its expected band.
  const statsByOverall: Record<
    number,
    { sackRate: number; rushYpc: number; penaltyCount: number }
  > = {
    30: { sackRate: 0.086, rushYpc: 3.75, penaltyCount: 0 },
    40: { sackRate: 0.075, rushYpc: 3.85, penaltyCount: 0 },
    50: { sackRate: 0.065, rushYpc: 4.05, penaltyCount: 0 },
    60: { sackRate: 0.055, rushYpc: 4.35, penaltyCount: 0 },
    70: { sackRate: 0.05, rushYpc: 4.7, penaltyCount: 0 },
    80: { sackRate: 0.05, rushYpc: 4.7, penaltyCount: 0 },
  };

  const teams: SimTeam[] = Object.entries(overallByTeam).map(([id, o]) =>
    team(id, [ot(`${id}-lt`, o), ot(`${id}-rt`, o)])
  );
  const league: CalibrationLeague = { calibrationSeed: 1, teams };

  let gameCount = 0;
  const simulate = ({ home, away, gameId }: {
    home: SimTeam;
    away: SimTeam;
    seed: number;
    gameId: string;
  }): GameResult => {
    gameCount++;
    return makeGame(gameId, home.teamId, away.teamId, {
      [home.teamId]: statsByOverall[overallByTeam[home.teamId]],
      [away.teamId]: statsByOverall[overallByTeam[away.teamId]],
    });
  };

  const report = runOtCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: teams.length * 12,
    minSamplesPerBucket: 5,
  });

  assertEquals(report.totalGames, teams.length * 12);
  // Each matchup produces 4 OT samples (2 per team).
  assertEquals(report.totalSamples, gameCount * 4);

  const fifty = report.buckets.find((b) => b.bucketLabel === "50")!;
  assertEquals(fifty.samples > 0, true);
  assertEquals(fifty.underSampled, false);
  // At least the sack_allowed_rate check should land in the average band.
  const sackCheck = fifty.checks.find((c) =>
    c.metricName === "team_sack_allowed_rate"
  )!;
  assertEquals(sackCheck.expectedBand, "average");
  assertEquals(sackCheck.passed, true);
});

Deno.test("runOtCalibration marks a bucket under-sampled when below threshold", () => {
  const teams: SimTeam[] = [team("t50", [ot("t50-lt", 50), ot("t50-rt", 50)])];
  const league: CalibrationLeague = { calibrationSeed: 1, teams };
  const simulate = (
    { home, away, gameId }: {
      home: SimTeam;
      away: SimTeam;
      seed: number;
      gameId: string;
    },
  ) =>
    makeGame(gameId, home.teamId, away.teamId, {
      [home.teamId]: { sackRate: 0.065, rushYpc: 4.05, penaltyCount: 0 },
      [away.teamId]: { sackRate: 0.065, rushYpc: 4.05, penaltyCount: 0 },
    });

  const report = runOtCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: 1,
    minSamplesPerBucket: 100,
  });

  const fifty = report.buckets.find((b) => b.bucketLabel === "50")!;
  assertEquals(fifty.underSampled, true);
  assertEquals(fifty.checks.length, 0);
});

Deno.test("formatOtCalibrationReport renders a human-readable summary with the PFF caveat", () => {
  const teams: SimTeam[] = [team("t50", [ot("t50-lt", 50), ot("t50-rt", 50)])];
  const league: CalibrationLeague = { calibrationSeed: 1, teams };
  const simulate = (
    { home, away, gameId }: {
      home: SimTeam;
      away: SimTeam;
      seed: number;
      gameId: string;
    },
  ) =>
    makeGame(gameId, home.teamId, away.teamId, {
      [home.teamId]: { sackRate: 0.065, rushYpc: 4.05, penaltyCount: 0 },
      [away.teamId]: { sackRate: 0.065, rushYpc: 4.05, penaltyCount: 0 },
    });

  const report = runOtCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: 100,
    minSamplesPerBucket: 1,
  });
  const output = formatOtCalibrationReport(report);
  assertStringIncludes(output, "OT calibration");
  assertStringIncludes(output, "bucket 50");
  assertStringIncludes(output, "team_sack_allowed_rate");
  assertStringIncludes(output, "PROXY METRICS");
});
