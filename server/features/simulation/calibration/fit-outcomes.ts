/**
 * Pure function that maps matchup-score distributions + NFL bands to the
 * coefficients consumed by `synthesize-run-outcome` and
 * `synthesize-pass-outcome`. PR 2 switches the run outcome to a continuous,
 * monotonic yardage model; the pass section remains on the PR 1 anchors
 * until PR 3 rewrites it in sigmoid form.
 */
import type { MetricBand } from "./band-loader.ts";

export interface Stats {
  mean: number;
  stddev: number;
}

export interface ScoreDistribution {
  blockScore: Stats;
  protectionScore: Stats;
  coverageScore: Stats;
}

export interface FitInputs {
  scores: ScoreDistribution;
  bands: Map<string, MetricBand>;
  /**
   * `overall` band from data/bands/rushing-plays.json — per-rush yardage
   * mean and sd used to anchor the continuous run yardage model.
   */
  rushingOverall: MetricBand;
}

export interface YardRange {
  min: number;
  max: number;
}

export interface PassCoefficients {
  completion: {
    base: number;
    coverageModifier: number;
    floor: number;
    ceiling: number;
  };
  interception: { base: number; coverageModifier: number; floor: number };
  sack: { base: number; protectionModifier: number; floor: number };
  bigPlay: {
    base: number;
    coverageModifier: number;
    floor: number;
    ceiling: number;
    yards: YardRange;
  };
  completionYards: YardRange;
  fumbleOnSack: number;
}

export interface RunCoefficients {
  /**
   * Parameters of the continuous yardage model
   *   yardage ~ Gaussian(yardageIntercept + yardageSlope · blockScore,
   *                      yardageStddev)
   * sampled once and clamped to [yardageMin, yardageMax]. `yardageSlope`
   * and `yardageStddev` are fit together so the aggregate per-rush yardage
   * mean / variance matches the `rushing-plays` overall NFL band.
   */
  yardageIntercept: number;
  yardageSlope: number;
  yardageStddev: number;
  yardageMin: number;
  yardageMax: number;
  /**
   * Yardage threshold above which a rush is tagged `big_play`. Chosen as
   * the NFL `overall` p90 so the tag's frequency tracks the league rate
   * automatically when inputs shift.
   */
  bigPlayCutoff: number;
  fumbleRate: number;
}

export interface FittedCoefficients {
  pass: PassCoefficients;
  run: RunCoefficients;
}

/**
 * Anchor values for the PR 1 pass section — still produces today's
 * hand-tuned PASS_RESOLUTION constants from today's measured distribution.
 * Replaced in PR 3 by a band-driven sigmoid fit.
 */
const PASS_ANCHORS = {
  completion: {
    anchorAtMean: 0.686031,
    modifier: 0.010,
    floor: 0.18,
    ceiling: 0.92,
  },
  interception: { anchorAtMean: 0.015794, modifier: 0.002, floor: 0.004 },
  sack: { anchorAtMean: 0.09647, modifier: 0.005, floor: 0.01 },
  bigPlay: {
    anchorAtMean: 0.196825,
    modifier: 0.008,
    floor: 0.05,
    ceiling: 0.45,
    yards: { min: 14, max: 35 },
  },
  completionYards: { min: 3, max: 15 },
  fumbleOnSack: 0.08,
} as const;

/**
 * Design knobs for the continuous run model. The slope is fixed here as a
 * documented sensitivity choice (0.25 yards of expected gain per unit of
 * blockScore, roughly the per-play marginal response of a strong run block
 * over a neutral one); the intercept and residual stddev are fit against
 * the NFL rushing band so aggregate mean and variance line up. Truncation
 * bounds and the big-play cutoff are fixed to realistic NFL limits.
 */
const RUN_CONFIG = {
  yardageSlope: 0.25,
  yardageMin: -8,
  yardageMax: 60,
  fumbleRate: 0.010,
} as const;

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function fitOutcomes(input: FitInputs): FittedCoefficients {
  if (input.bands.size === 0) {
    throw new Error("fitOutcomes requires a non-empty bands map");
  }

  const { scores, rushingOverall } = input;

  const pass: PassCoefficients = {
    completion: {
      base: roundTo(
        PASS_ANCHORS.completion.anchorAtMean -
          scores.coverageScore.mean * PASS_ANCHORS.completion.modifier,
        4,
      ),
      coverageModifier: PASS_ANCHORS.completion.modifier,
      floor: PASS_ANCHORS.completion.floor,
      ceiling: PASS_ANCHORS.completion.ceiling,
    },
    interception: {
      base: roundTo(
        PASS_ANCHORS.interception.anchorAtMean +
          scores.coverageScore.mean * PASS_ANCHORS.interception.modifier,
        4,
      ),
      coverageModifier: PASS_ANCHORS.interception.modifier,
      floor: PASS_ANCHORS.interception.floor,
    },
    sack: {
      base: roundTo(
        PASS_ANCHORS.sack.anchorAtMean +
          scores.protectionScore.mean * PASS_ANCHORS.sack.modifier,
        4,
      ),
      protectionModifier: PASS_ANCHORS.sack.modifier,
      floor: PASS_ANCHORS.sack.floor,
    },
    bigPlay: {
      base: roundTo(
        PASS_ANCHORS.bigPlay.anchorAtMean -
          scores.coverageScore.mean * PASS_ANCHORS.bigPlay.modifier,
        4,
      ),
      coverageModifier: PASS_ANCHORS.bigPlay.modifier,
      floor: PASS_ANCHORS.bigPlay.floor,
      ceiling: PASS_ANCHORS.bigPlay.ceiling,
      yards: PASS_ANCHORS.bigPlay.yards,
    },
    completionYards: PASS_ANCHORS.completionYards,
    fumbleOnSack: PASS_ANCHORS.fumbleOnSack,
  };

  // Continuous run model fit:
  //   yardage = Gaussian(α + β·bs, σ) clamped to [yMin, yMax]
  //   Match mean:    α + β · E[BS]       = rushingOverall.mean
  //   Match variance: β² · Var[BS] + σ²   = rushingOverall.sd²
  const β = RUN_CONFIG.yardageSlope;
  const bsMean = scores.blockScore.mean;
  const bsVar = scores.blockScore.stddev ** 2;
  const targetVar = rushingOverall.sd ** 2;
  const residualVar = Math.max(0, targetVar - β * β * bsVar);

  const run: RunCoefficients = {
    yardageIntercept: roundTo(rushingOverall.mean - β * bsMean, 4),
    yardageSlope: β,
    yardageStddev: roundTo(Math.sqrt(residualVar), 4),
    yardageMin: RUN_CONFIG.yardageMin,
    yardageMax: RUN_CONFIG.yardageMax,
    bigPlayCutoff: rushingOverall.p90,
    fumbleRate: RUN_CONFIG.fumbleRate,
  };

  return { pass, run };
}
