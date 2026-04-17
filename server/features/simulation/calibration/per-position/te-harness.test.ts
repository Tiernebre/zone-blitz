import { assertEquals, assertStringIncludes } from "@std/assert";
import type { PlayerAttributes } from "@zone-blitz/shared";
import { formatTeCalibrationReport, runTeCalibration } from "./te-harness.ts";
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

function teRuntime(id: string, overall: number): PlayerRuntime {
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

function bandJson(): string {
  const band = (yptMean: number) => ({
    n: 20,
    metrics: {
      catch_rate: { n: 20, mean: 0.70, sd: 0.06 },
      yards_per_reception: { n: 20, mean: 10.5, sd: 1.5 },
      yards_per_target: { n: 20, mean: yptMean, sd: 0.9 },
      td_rate: { n: 20, mean: 0.05, sd: 0.03 },
      yards_per_game: { n: 20, mean: yptMean * 5, sd: 12 },
    },
  });
  return JSON.stringify({
    position: "TE",
    seasons: [2020, 2021, 2022, 2023, 2024],
    ranking_stat: "epa_per_target",
    bands: {
      elite: band(9.7),
      good: band(8.1),
      average: band(7.3),
      weak: band(6.3),
      replacement: band(5.5),
    },
  });
}

function makeGame(
  gameId: string,
  homeTeamId: string,
  awayTeamId: string,
  teByTeam: Record<string, string>,
  yptByTeam: Record<string, number>,
): GameResult {
  const events: PlayEvent[] = [];
  for (const [offenseTeamId, ypt] of Object.entries(yptByTeam)) {
    const defenseTeamId = offenseTeamId === homeTeamId
      ? awayTeamId
      : homeTeamId;
    const tePlayerId = teByTeam[offenseTeamId];
    const targets = 8;
    for (let i = 0; i < targets; i++) {
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
          {
            role: "route_coverage",
            playerId: tePlayerId,
            tags: ["target", "reception"],
          },
        ],
        outcome: "pass_complete",
        // Every reception worth `ypt` yards — because reception rate
        // is 100% in this stub, yards_per_target == yards_per_reception
        // and the check against `yards_per_target` band lands cleanly.
        yardage: ypt,
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

Deno.test("runTeCalibration runs the sim, buckets TEs, and returns a populated report", () => {
  // Build a league where each team's starter TE is at a different
  // overall, giving us one team per bucket. The stub simulate maps
  // each team's yards-per-target directly to its TE overall so every
  // bucket lands in its target band.
  const overallByTeam: Record<string, number> = {
    "t30": 30,
    "t40": 40,
    "t50": 50,
    "t60": 60,
    "t70": 70,
    "t80": 80,
  };
  const yptByOverall: Record<number, number> = {
    30: 5.5,
    40: 6.3,
    50: 7.3,
    60: 8.1,
    70: 9.7,
    80: 9.7,
  };

  const teams: SimTeam[] = Object.entries(overallByTeam).map(([id, o]) =>
    team(id, teRuntime(`${id}-te`, o))
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
    return makeGame(
      gameId,
      home.teamId,
      away.teamId,
      {
        [home.teamId]: `${home.teamId}-te`,
        [away.teamId]: `${away.teamId}-te`,
      },
      {
        [home.teamId]: yptByOverall[overallByTeam[home.teamId]],
        [away.teamId]: yptByOverall[overallByTeam[away.teamId]],
      },
    );
  };

  const report = runTeCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: teams.length * 12,
    minSamplesPerBucket: 5,
  });

  assertEquals(report.totalGames, teams.length * 12);
  // Each matchup produces 2 samples (home + away TE).
  assertEquals(report.totalSamples, gameCount * 2);

  const fifty = report.buckets.find((b) => b.bucketLabel === "50")!;
  assertEquals(fifty.samples > 0, true);
  assertEquals(fifty.underSampled, false);
  assertEquals(fifty.checks.length > 0, true);
  const yptCheck = fifty.checks.find((c) =>
    c.metricName === "yards_per_target"
  )!;
  assertEquals(yptCheck.passed, true);
});

Deno.test("runTeCalibration marks a bucket under-sampled when below min threshold", () => {
  const teams: SimTeam[] = [team("t50", teRuntime("t50-te", 50))];
  const league: CalibrationLeague = { calibrationSeed: 1, teams };
  const simulate = (
    { home, away, gameId }: {
      home: SimTeam;
      away: SimTeam;
      seed: number;
      gameId: string;
    },
  ) =>
    makeGame(
      gameId,
      home.teamId,
      away.teamId,
      { [home.teamId]: "t50-te", [away.teamId]: "t50-te" },
      { [home.teamId]: 7.3, [away.teamId]: 7.3 },
    );

  const report = runTeCalibration({
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

Deno.test("formatTeCalibrationReport renders a human-readable summary", () => {
  const teams: SimTeam[] = [team("t50", teRuntime("t50-te", 50))];
  const league: CalibrationLeague = { calibrationSeed: 1, teams };
  const simulate = (
    { home, away, gameId }: {
      home: SimTeam;
      away: SimTeam;
      seed: number;
      gameId: string;
    },
  ) =>
    makeGame(
      gameId,
      home.teamId,
      away.teamId,
      { [home.teamId]: "t50-te", [away.teamId]: "t50-te" },
      { [home.teamId]: 7.3, [away.teamId]: 7.3 },
    );

  const report = runTeCalibration({
    bandJson: bandJson(),
    league,
    simulate,
    gameCount: 100,
    minSamplesPerBucket: 1,
  });
  const output = formatTeCalibrationReport(report);
  assertStringIncludes(output, "TE calibration");
  assertStringIncludes(output, "bucket 50");
  assertStringIncludes(output, "yards_per_target");
});
