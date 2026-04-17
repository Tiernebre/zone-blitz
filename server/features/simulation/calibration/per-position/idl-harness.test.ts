import { assertEquals, assertStringIncludes } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import {
  formatIdlCalibrationReport,
  runIdlCalibration,
} from "./idl-harness.ts";
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

function idlRuntime(id: string, overall: number): PlayerRuntime {
  return {
    playerId: id,
    neutralBucket: "IDL",
    attributes: attrs({
      passRushing: overall,
      strength: overall,
      blockShedding: overall,
      runDefense: overall,
      tackling: overall,
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
  const band = (sacks: number, tackles: number) => ({
    n: 20,
    metrics: {
      sacks_per_game: { n: 20, mean: sacks, sd: 0.1 },
      qb_hits_per_game: { n: 20, mean: sacks * 2, sd: 0.2 },
      tfl_per_game: { n: 20, mean: sacks, sd: 0.1 },
      tackles_per_game: { n: 20, mean: tackles, sd: 0.5 },
    },
  });
  return JSON.stringify({
    position: "IDL",
    seasons: [2021, 2022, 2023, 2024, 2025],
    ranking_stat: "composite z-score",
    bands: {
      elite: band(0.5, 3.5),
      good: band(0.3, 2.8),
      average: band(0.15, 2.4),
      weak: band(0.06, 2.0),
      replacement: band(0.03, 1.4),
    },
  });
}

function makeGame(
  gameId: string,
  homeTeamId: string,
  awayTeamId: string,
  sacksByDefendingTeam: Record<string, { defenderId: string; count: number }>,
): GameResult {
  const events: PlayEvent[] = [];
  for (
    const [defenseTeamId, spec] of Object.entries(sacksByDefendingTeam)
  ) {
    const offenseTeamId = defenseTeamId === homeTeamId
      ? awayTeamId
      : homeTeamId;
    for (let i = 0; i < spec.count; i++) {
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
        participants: [
          { role: "pass_rush", playerId: spec.defenderId, tags: ["sack"] },
        ],
        outcome: "sack",
        yardage: -6,
        tags: ["sack"],
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

Deno.test("runIdlCalibration runs the sim, buckets IDLs, and returns a populated report", () => {
  // One team per bucket — each team's two starter IDLs are at the
  // same overall so both map to the same bucket label.
  const overalls = [30, 40, 50, 60, 70, 80] as const;
  const teams: SimTeam[] = overalls.map((o) =>
    team(`t${o}`, [
      idlRuntime(`t${o}-idl1`, o),
      idlRuntime(`t${o}-idl2`, o),
    ])
  );
  const sacksByOverall: Record<number, number> = {
    30: 0.03,
    40: 0.06,
    50: 0.15,
    60: 0.3,
    70: 0.5,
    80: 0.5,
  };
  const league: CalibrationLeague = { calibrationSeed: 1, teams };

  const simulate = (
    { home, away, gameId }: {
      home: SimTeam;
      away: SimTeam;
      seed: number;
      gameId: string;
    },
  ): GameResult => {
    const homeOverall = Number(home.teamId.slice(1));
    const awayOverall = Number(away.teamId.slice(1));
    // Simple mapping: expected sacks/game = bucket target * #starters,
    // so dividing by #starters (2) lands each IDL on its band mean.
    return makeGame(gameId, home.teamId, away.teamId, {
      [home.teamId]: {
        defenderId: `${home.teamId}-idl1`,
        count: Math.round(sacksByOverall[homeOverall] * 2),
      },
      [away.teamId]: {
        defenderId: `${away.teamId}-idl1`,
        count: Math.round(sacksByOverall[awayOverall] * 2),
      },
    });
  };

  const report = runIdlCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: teams.length * 12,
    minSamplesPerBucket: 5,
  });

  assertEquals(report.totalGames, teams.length * 12);
  // Each matchup produces 4 samples (2 IDL starters per team × 2 teams).
  assertEquals(report.totalSamples, report.totalGames * 4);

  const fifty = report.buckets.find((b) => b.bucketLabel === "50")!;
  assertEquals(fifty.samples > 0, true);
  assertEquals(fifty.underSampled, false);
  assertEquals(fifty.checks.length > 0, true);
});

Deno.test("runIdlCalibration marks a bucket under-sampled when below min threshold", () => {
  const teams: SimTeam[] = [
    team("t50", [idlRuntime("t50-idl1", 50), idlRuntime("t50-idl2", 50)]),
  ];
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
      [home.teamId]: { defenderId: `${home.teamId}-idl1`, count: 1 },
      [away.teamId]: { defenderId: `${away.teamId}-idl1`, count: 1 },
    });

  const report = runIdlCalibration({
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

Deno.test("formatIdlCalibrationReport renders a human-readable summary", () => {
  const teams: SimTeam[] = [
    team("t50", [idlRuntime("t50-idl1", 50), idlRuntime("t50-idl2", 50)]),
  ];
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
      [home.teamId]: { defenderId: `${home.teamId}-idl1`, count: 1 },
      [away.teamId]: { defenderId: `${away.teamId}-idl1`, count: 1 },
    });

  const report = runIdlCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: 100,
    minSamplesPerBucket: 1,
  });
  const output = formatIdlCalibrationReport(report);
  assertStringIncludes(output, "IDL calibration");
  assertStringIncludes(output, "bucket 50");
  assertStringIncludes(output, "sacks_per_game");
});
