/**
 * Runs the simulator across a seed sweep with a score-observer installed,
 * and returns summary statistics for the intermediate matchup scores
 * consumed by the fit-outcomes pipeline.
 */
import {
  createCollectingObserver,
  type ScoreSamples,
  setScoreObserver,
} from "../score-observer.ts";
import { simulateSeason } from "../simulate-season.ts";
import type { ScoreDistribution, Stats } from "./fit-outcomes.ts";

export interface MeasureScoresOptions {
  seeds: number[];
  teamCount?: number;
  gamesPerTeam?: number;
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
  setScoreObserver(observer);
  try {
    for (const seed of options.seeds) {
      simulateSeason({
        leagueSeed: seed,
        teamCount: options.teamCount,
        gamesPerTeam: options.gamesPerTeam,
      });
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
