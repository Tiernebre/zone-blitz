import { assertEquals, assertStringIncludes } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { formatLbCalibrationReport, runLbCalibration } from "./lb-harness.ts";
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

function lbRuntime(id: string, overall: number): PlayerRuntime {
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

function team(teamId: string, starterLb: PlayerRuntime): SimTeam {
  return {
    teamId,
    starters: [starterLb],
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
  const band = (tackles: number, tfl: number, solo: number, pbu: number) => ({
    n: 20,
    metrics: {
      tackles_per_game: { n: 20, mean: tackles, sd: 0.8 },
      tfl_per_game: { n: 20, mean: tfl, sd: 0.2 },
      solo_tackle_rate: { n: 20, mean: solo, sd: 0.06 },
      pbu_per_game: { n: 20, mean: pbu, sd: 0.1 },
    },
  });
  return JSON.stringify({
    position: "LB",
    seasons: [2020, 2021, 2022, 2023, 2024],
    ranking_stat: "composite",
    bands: {
      elite: band(8.8, 0.46, 0.56, 0.35),
      good: band(7.3, 0.42, 0.56, 0.28),
      average: band(5.9, 0.33, 0.56, 0.2),
      weak: band(4.7, 0.23, 0.56, 0.15),
      replacement: band(3.6, 0.14, 0.56, 0.08),
    },
  });
}

function makeGame(
  gameId: string,
  homeTeamId: string,
  awayTeamId: string,
  teamTacklesByDefense: Record<string, number>,
): GameResult {
  const events: PlayEvent[] = [];
  for (
    const [defenseTeamId, tackles] of Object.entries(teamTacklesByDefense)
  ) {
    const offenseTeamId = defenseTeamId === homeTeamId
      ? awayTeamId
      : homeTeamId;
    for (let i = 0; i < tackles; i++) {
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
        yardage: 4,
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

Deno.test("runLbCalibration runs the sim, buckets LBs, and returns a populated report", () => {
  // Build a league where each team's starter LB sits at a different
  // overall. The stub simulate delivers a team-tackle volume tuned so
  // each bucket lands on its expected NFL band's tackles/game.
  // Allocation: team tackles * 0.45 (LB share) / 1 LB = tackles/LB.
  // Target tackles/LB by overall: 50-bucket => 5.9 (avg), so
  // team-tackles = 5.9 / 0.45 ≈ 13.1.
  const overallByTeam: Record<string, number> = {
    "t30": 30,
    "t40": 40,
    "t50": 50,
    "t60": 60,
    "t70": 70,
    "t80": 80,
  };
  const tacklesPerLbByOverall: Record<number, number> = {
    30: 3.6,
    40: 4.7,
    50: 5.9,
    60: 7.3,
    70: 8.8,
    80: 8.8,
  };

  const teams: SimTeam[] = Object.entries(overallByTeam).map(([id, o]) =>
    team(id, lbRuntime(`${id}-lb`, o))
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
    // team tackles required so that team-tackles * 0.45 = target
    const homeTeamTackles = Math.round(
      tacklesPerLbByOverall[overallByTeam[home.teamId]] / 0.45,
    );
    const awayTeamTackles = Math.round(
      tacklesPerLbByOverall[overallByTeam[away.teamId]] / 0.45,
    );
    return makeGame(gameId, home.teamId, away.teamId, {
      [home.teamId]: homeTeamTackles,
      [away.teamId]: awayTeamTackles,
    });
  };

  const report = runLbCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: teams.length * 12,
    minSamplesPerBucket: 5,
  });

  assertEquals(report.totalGames, teams.length * 12);
  // Each matchup produces 2 samples (one per team, 1 starter each).
  assertEquals(report.totalSamples, gameCount * 2);

  const fifty = report.buckets.find((b) => b.bucketLabel === "50")!;
  assertEquals(fifty.samples > 0, true);
  assertEquals(fifty.underSampled, false);
  assertEquals(fifty.checks.length > 0, true);
  const tacklesCheck = fifty.checks.find((c) =>
    c.metricName === "tackles_per_game"
  )!;
  assertEquals(tacklesCheck.passed, true);
});

Deno.test("runLbCalibration marks a bucket under-sampled when below min threshold", () => {
  const teams: SimTeam[] = [team("t50", lbRuntime("t50-lb", 50))];
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
      [home.teamId]: 13,
      [away.teamId]: 13,
    });

  const report = runLbCalibration({
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

Deno.test("formatLbCalibrationReport renders a human-readable summary", () => {
  const teams: SimTeam[] = [team("t50", lbRuntime("t50-lb", 50))];
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
      [home.teamId]: 13,
      [away.teamId]: 13,
    });

  const report = runLbCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: 100,
    minSamplesPerBucket: 1,
  });
  const output = formatLbCalibrationReport(report);
  assertStringIncludes(output, "LB calibration");
  assertStringIncludes(output, "bucket 50");
  assertStringIncludes(output, "tackles_per_game");
});
