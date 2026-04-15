import { deriveGameSeed } from "../rng.ts";
import { loadBands } from "./band-loader.ts";
import { CALIBRATION_GAME_COUNT } from "./constants.ts";
import { CALIBRATION_SEED } from "./calibration-seed.ts";
import { computeDistribution } from "./compute-distribution.ts";
import { deriveTeamGameStats, type TeamGameSample } from "./team-game-stats.ts";
import { checkThreeGate, type GateResult } from "./three-gate.ts";
import type { CalibrationLeague } from "./generate-calibration-league.ts";
import type { GameResult } from "../events.ts";
import type { SimTeam } from "../simulate-game.ts";

export interface CalibrationReport {
  totalGames: number;
  totalTeamGames: number;
  results: GateResult[];
  failures: GateResult[];
  passed: boolean;
}

interface Matchup {
  home: SimTeam;
  away: SimTeam;
}

export type SimulateFn = (input: {
  home: SimTeam;
  away: SimTeam;
  seed: number;
  gameId: string;
}) => GameResult;

export interface CalibrationOptions {
  bandJson: string;
  league: CalibrationLeague;
  gameCount?: number;
  simulate: SimulateFn;
}

export function generateMatchups(
  teams: SimTeam[],
  gameCount: number,
): Matchup[] {
  const matchups: Matchup[] = [];
  const n = teams.length;

  for (let i = 0; i < gameCount; i++) {
    const homeIdx = i % n;
    let awayIdx = (homeIdx + 1 + Math.floor(i / n)) % n;
    if (awayIdx === homeIdx) {
      awayIdx = (awayIdx + 1) % n;
    }
    matchups.push({ home: teams[homeIdx], away: teams[awayIdx] });
  }

  return matchups;
}

const TEAM_GAME_METRIC_KEYS: (keyof TeamGameSample)[] = [
  "plays",
  "pass_attempts",
  "rush_attempts",
  "pass_rate",
  "rush_rate",
  "completion_pct",
  "yards_per_attempt",
  "yards_per_carry",
  "pass_yards",
  "rush_yards",
  "sacks_taken",
  "interceptions",
  "fumbles_lost",
  "turnovers",
  "penalties",
];

export function runCalibration(options: CalibrationOptions): CalibrationReport {
  const {
    bandJson,
    league,
    gameCount = CALIBRATION_GAME_COUNT,
    simulate,
  } = options;

  const bands = loadBands(bandJson);
  const matchups = generateMatchups(league.teams, gameCount);

  const samples: TeamGameSample[] = [];

  for (let i = 0; i < matchups.length; i++) {
    const { home, away } = matchups[i];
    const gameId = `calibration-game-${i}`;
    const seed = deriveGameSeed(CALIBRATION_SEED, gameId);

    const result = simulate({ home, away, seed, gameId });
    const [homeSample, awaySample] = deriveTeamGameStats(
      result,
      home.teamId,
      away.teamId,
    );
    samples.push(homeSample, awaySample);
  }

  const results: GateResult[] = [];

  for (const [metricName, band] of bands) {
    const key = metricName as keyof TeamGameSample;
    if (!TEAM_GAME_METRIC_KEYS.includes(key)) continue;

    const values = samples.map((s) => s[key] as number);
    const dist = computeDistribution(values);
    results.push(checkThreeGate(metricName, band, dist));
  }

  const failures = results.filter((r) => !r.passed);

  return {
    totalGames: matchups.length,
    totalTeamGames: samples.length,
    results,
    failures,
    passed: failures.length === 0,
  };
}
