import { assertEquals, assertStringIncludes } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import {
  formatIolCalibrationReport,
  runIolCalibration,
} from "./iol-harness.ts";
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

function bandJson(): string {
  const band = (sack: number, stuff: number, pen: number) => ({
    n: 20,
    metrics: {
      team_sack_allowed_rate: { n: 20, mean: sack, sd: 0.01 },
      team_stuff_rate_inside: { n: 20, mean: stuff, sd: 0.02 },
      penalties_per_game: { n: 20, mean: pen, sd: 0.1 },
      starts_per_season: { n: 20, mean: 15, sd: 1.5 },
    },
  });
  return JSON.stringify({
    position: "IOL",
    seasons: [2020, 2021, 2022, 2023, 2024],
    ranking_stat: "composite proxy",
    bands: {
      elite: band(0.036, 0.10, 0.26),
      good: band(0.047, 0.12, 0.21),
      average: band(0.058, 0.15, 0.20),
      weak: band(0.071, 0.17, 0.21),
      replacement: band(0.076, 0.22, 0.25),
    },
  });
}

function makeGame(
  gameId: string,
  homeTeamId: string,
  awayTeamId: string,
  statsByTeam: Record<
    string,
    { dropbacks: number; sacks: number; interiorRuns: number; stuffs: number }
  >,
): GameResult {
  const events: PlayEvent[] = [];
  for (const [offenseTeamId, stats] of Object.entries(statsByTeam)) {
    const defenseTeamId = offenseTeamId === homeTeamId
      ? awayTeamId
      : homeTeamId;
    const nonSackDropbacks = stats.dropbacks - stats.sacks;
    for (let i = 0; i < nonSackDropbacks; i++) {
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
    for (let i = 0; i < stats.sacks; i++) {
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
    for (let i = 0; i < stats.interiorRuns; i++) {
      const isStuff = i < stats.stuffs;
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
          formation: "shotgun",
          motion: "none",
        },
        coverage: { front: "4-3", coverage: "cover_2", pressure: "four_man" },
        participants: [],
        outcome: "rush",
        yardage: isStuff ? 0 : 5,
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

Deno.test("runIolCalibration buckets IOL starters and returns a populated report", () => {
  // Map each team's IOL overall to a target sack-allowed rate that
  // lands in its expected band. Each team has three IOL starters so
  // per-team sample volume is 3x.
  const overallByTeam: Record<string, number> = {
    "t30": 30,
    "t40": 40,
    "t50": 50,
    "t60": 60,
    "t70": 70,
    "t80": 80,
  };
  const sackRateByOverall: Record<number, number> = {
    30: 0.076,
    40: 0.071,
    50: 0.058,
    60: 0.047,
    70: 0.036,
    80: 0.036,
  };

  const teams: SimTeam[] = Object.entries(overallByTeam).map(([id, o]) =>
    team(id, [
      lineman(`${id}-c`, o),
      lineman(`${id}-lg`, o),
      lineman(`${id}-rg`, o),
    ])
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
    const sackTarget = sackRateByOverall[overallByTeam[home.teamId]];
    const awayTarget = sackRateByOverall[overallByTeam[away.teamId]];
    return makeGame(gameId, home.teamId, away.teamId, {
      [home.teamId]: {
        dropbacks: 40,
        sacks: Math.round(40 * sackTarget),
        interiorRuns: 20,
        stuffs: Math.round(20 * 0.15),
      },
      [away.teamId]: {
        dropbacks: 40,
        sacks: Math.round(40 * awayTarget),
        interiorRuns: 20,
        stuffs: Math.round(20 * 0.15),
      },
    });
  };

  const report = runIolCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: teams.length * 12,
    minSamplesPerBucket: 5,
  });

  assertEquals(report.totalGames, teams.length * 12);
  // 2 teams per game * 3 IOL starters = 6 samples per game.
  assertEquals(report.totalSamples, gameCount * 6);

  const fifty = report.buckets.find((b) => b.bucketLabel === "50")!;
  assertEquals(fifty.samples > 0, true);
  assertEquals(fifty.underSampled, false);
  assertEquals(fifty.checks.length > 0, true);
});

Deno.test("runIolCalibration marks a bucket under-sampled when below min threshold", () => {
  const teams: SimTeam[] = [team("t50", [lineman("t50-c", 50)])];
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
      [home.teamId]: {
        dropbacks: 40,
        sacks: 2,
        interiorRuns: 20,
        stuffs: 3,
      },
      [away.teamId]: {
        dropbacks: 40,
        sacks: 2,
        interiorRuns: 20,
        stuffs: 3,
      },
    });

  const report = runIolCalibration({
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

Deno.test("formatIolCalibrationReport renders a human-readable summary that flags the proxy limitation", () => {
  const teams: SimTeam[] = [team("t50", [lineman("t50-c", 50)])];
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
      [home.teamId]: {
        dropbacks: 40,
        sacks: 2,
        interiorRuns: 20,
        stuffs: 3,
      },
      [away.teamId]: {
        dropbacks: 40,
        sacks: 2,
        interiorRuns: 20,
        stuffs: 3,
      },
    });

  const report = runIolCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: 100,
    minSamplesPerBucket: 1,
  });
  const output = formatIolCalibrationReport(report);
  assertStringIncludes(output, "IOL calibration");
  assertStringIncludes(output, "bucket 50");
  assertStringIncludes(output, "team_sack_allowed_rate");
  // Flags the proxy-metric caveat prominently in the output header so
  // anyone reading the report sees the limitation up front.
  assertStringIncludes(output, "proxies");
});
