/**
 * Runs the simulator across a seed sweep of calibration leagues with a
 * score-observer installed, and returns summary statistics for the
 * intermediate matchup scores consumed by the fit-outcomes pipeline.
 *
 * Using the calibration league generator (not `simulateSeason`'s own
 * random player generator) is important: the fitter's coefficients are
 * later evaluated by the calibration harness, and both must observe the
 * same distribution or the coefficients will be tuned to the wrong
 * population.
 */
import { deriveGameSeed } from "../rng.ts";
import {
  createCollectingObserver,
  type ScoreSamples,
  setScoreObserver,
} from "../score-observer.ts";
import { simulateGame } from "../simulate-game.ts";
import { CALIBRATION_GAME_COUNT } from "./constants.ts";
import { generateCalibrationLeague } from "./generate-calibration-league.ts";
import { generateMatchups } from "./harness.ts";
import type { ScoreDistribution, Stats } from "./fit-outcomes.ts";

export interface MeasureScoresOptions {
  seeds: number[];
  gamesPerSeed?: number;
}

export interface MeasuredDistribution extends ScoreDistribution {
  sampleCounts: {
    blockScore: number;
    protectionScore: number;
    coverageScore: number;
  };
  seeds: number[];
}

function toStats(values: number[]): Stats {
  if (values.length === 0) return { mean: 0, stddev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) /
    values.length;
  return { mean, stddev: Math.sqrt(variance) };
}

export function summarizeSamples(samples: ScoreSamples): ScoreDistribution {
  return {
    blockScore: toStats(samples.blockScore),
    protectionScore: toStats(samples.protectionScore),
    coverageScore: toStats(samples.coverageScore),
  };
}

export function measureScores(
  options: MeasureScoresOptions,
): MeasuredDistribution {
  const { samples, observer } = createCollectingObserver();
  const gamesPerSeed = options.gamesPerSeed ?? CALIBRATION_GAME_COUNT;

  setScoreObserver(observer);
  try {
    for (const seed of options.seeds) {
      const league = generateCalibrationLeague({ seed });
      const matchups = generateMatchups(league.teams, gamesPerSeed);
      for (let i = 0; i < matchups.length; i++) {
        const { home, away } = matchups[i];
        const gameId = `measure-scores-${seed}-${i}`;
        const gameSeed = deriveGameSeed(league.calibrationSeed, gameId);
        simulateGame({ home, away, seed: gameSeed, gameId });
      }
    }
  } finally {
    setScoreObserver(null);
  }

  const summary = summarizeSamples(samples);
  return {
    ...summary,
    sampleCounts: {
      blockScore: samples.blockScore.length,
      protectionScore: samples.protectionScore.length,
      coverageScore: samples.coverageScore.length,
    },
    seeds: options.seeds,
  };
}
