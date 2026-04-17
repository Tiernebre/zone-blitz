/**
 * Pure function that maps matchup-score distributions + NFL bands to the
 * coefficients consumed by `synthesize-run-outcome` and
 * `synthesize-pass-outcome`. Both sections are now band-driven: run
 * yardage fits against `rushing-plays.overall`, pass probabilities fit
 * against the team-game and passing-plays bands via logit solves so each
 * sigmoid evaluates to the target league rate at the measured score mean.
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
  /** NFL team-game bands (completion_pct, sacks_taken, etc.). */
  bands: Map<string, MetricBand>;
  /**
   * `overall` band from data/bands/rushing-plays.json — per-rush yardage
   * mean and sd used to anchor the continuous run yardage model.
   */
  rushingOverall: MetricBand;
  /**
   * Fraction of completions that go for 20+ yards, from
   * data/bands/passing-plays.json bands.big_play_rate.twenty_plus_per_completion.rate.
   */
  passingBigPlayRate: number;
}

export interface YardRange {
  min: number;
  max: number;
}

export interface SigmoidCoefficients {
  intercept: number;
  slope: number;
}

export interface PassCoefficients {
  /** sackProb = sigmoid(intercept + slope · protectionScore) */
  sack: SigmoidCoefficients;
  /** completionProb | not-sacked = sigmoid(intercept + slope · coverageScore) */
  completion: SigmoidCoefficients;
  /** interceptionProb | not-sacked = sigmoid(intercept + slope · coverageScore) */
  interception: SigmoidCoefficients;
  /** bigPlayProb | completion = sigmoid(intercept + slope · coverageScore) */
  bigPlay: SigmoidCoefficients;
  sackYards: YardRange;
  completionYards: YardRange;
  bigPlayYards: YardRange;
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
 * Slopes (sensitivity of each probability to the relevant matchup score)
 * are fixed design choices; intercepts are solved against NFL band
 * targets. Logit inversion keeps the sigmoid evaluating to exactly the
 * target rate at the league-average score — any distribution shift
 * regenerates intercepts automatically.
 */
const PASS_CONFIG = {
  sackSlope: -0.10,
  completionSlope: 0.05,
  interceptionSlope: -0.05,
  bigPlaySlope: 0.04,
  sackYards: { min: -10, max: -3 },
  completionYards: { min: 3, max: 15 },
  bigPlayYards: { min: 14, max: 35 },
  fumbleOnSack: 0.08,
} as const;

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

function logit(p: number): number {
  if (p <= 0 || p >= 1) {
    throw new Error(`logit requires 0 < p < 1, got ${p}`);
  }
  return Math.log(p / (1 - p));
}

function requireBand(
  bands: Map<string, MetricBand>,
  name: string,
): MetricBand {
  const band = bands.get(name);
  if (!band) throw new Error(`bands missing required metric "${name}"`);
  return band;
}

/**
 * Derive per-pass-call (or per-attempt) target rates from the team-game
 * bands. These targets drive the sigmoid intercept solves.
 */
function deriveTargets(bands: Map<string, MetricBand>) {
  const passAttempts = requireBand(bands, "pass_attempts").mean;
  const sacks = requireBand(bands, "sacks_taken").mean;
  const completionPct = requireBand(bands, "completion_pct").mean;
  const interceptions = requireBand(bands, "interceptions").mean;

  const passCalls = passAttempts + sacks;
  return {
    sackPerCall: sacks / passCalls,
    completionPerAttempt: completionPct,
    interceptionPerAttempt: interceptions / passAttempts,
  };
}

export function fitOutcomes(input: FitInputs): FittedCoefficients {
  if (input.bands.size === 0) {
    throw new Error("fitOutcomes requires a non-empty bands map");
  }
  if (input.passingBigPlayRate <= 0 || input.passingBigPlayRate >= 1) {
    throw new Error(
      `passingBigPlayRate must be in (0,1), got ${input.passingBigPlayRate}`,
    );
  }

  const { scores, rushingOverall } = input;
  const targets = deriveTargets(input.bands);

  // Sigmoid intercept solve: σ(intercept + slope·mean) = target
  //   intercept = logit(target) - slope · mean
  const pass: PassCoefficients = {
    sack: {
      intercept: roundTo(
        logit(targets.sackPerCall) -
          PASS_CONFIG.sackSlope * scores.protectionScore.mean,
        6,
      ),
      slope: PASS_CONFIG.sackSlope,
    },
    completion: {
      intercept: roundTo(
        logit(targets.completionPerAttempt) -
          PASS_CONFIG.completionSlope * scores.coverageScore.mean,
        6,
      ),
      slope: PASS_CONFIG.completionSlope,
    },
    interception: {
      intercept: roundTo(
        logit(targets.interceptionPerAttempt) -
          PASS_CONFIG.interceptionSlope * scores.coverageScore.mean,
        6,
      ),
      slope: PASS_CONFIG.interceptionSlope,
    },
    bigPlay: {
      intercept: roundTo(
        logit(input.passingBigPlayRate) -
          PASS_CONFIG.bigPlaySlope * scores.coverageScore.mean,
        6,
      ),
      slope: PASS_CONFIG.bigPlaySlope,
    },
    sackYards: PASS_CONFIG.sackYards,
    completionYards: PASS_CONFIG.completionYards,
    bigPlayYards: PASS_CONFIG.bigPlayYards,
    fumbleOnSack: PASS_CONFIG.fumbleOnSack,
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
