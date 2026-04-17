/**
 * Pure function that maps matchup-score distributions + NFL bands to the
 * coefficients consumed by `synthesize-run-outcome` and
 * `synthesize-pass-outcome`. PR 1 scaffolding reproduces today's hand-tuned
 * values from today's distribution; PR 2/3 will rewrite the math so
 * coefficients are derived directly from the bands once the outcome
 * mappings are continuous/sigmoid.
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
  stuffThreshold: number;
  stuffYards: YardRange;
  shortGainThreshold: number;
  shortGainYards: YardRange;
  bigPlayThreshold: number;
  bigPlayYards: YardRange;
  normalYards: YardRange;
  fumbleRate: number;
}

export interface FittedCoefficients {
  pass: PassCoefficients;
  run: RunCoefficients;
}

/**
 * Anchor values chosen so that, given the current measured score
 * distribution (see measured-scores.json), the fitter reproduces today's
 * hand-tuned RUN_RESOLUTION / PASS_RESOLUTION constants to within rounding.
 *
 * Interpretation: each `anchorAtMean` is the probability the current engine
 * lands at when the relevant matchup score equals the league-average score;
 * each `sdMultiplier` places a run-yardage threshold a fixed number of
 * standard deviations from the blockScore mean. Encoding these explicitly
 * makes the regression test a straightforward back-substitution.
 *
 * PR 2/3 replace these anchors with a band-driven least-squares solve once
 * the outcome mappings become continuous/sigmoid.
 */
const FIT_CONFIG = {
  pass: {
    completion: {
      anchorAtMean: 0.686031,
      modifier: 0.010,
      floor: 0.18,
      ceiling: 0.92,
    },
    interception: {
      anchorAtMean: 0.015794,
      modifier: 0.002,
      floor: 0.004,
    },
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
  },
  run: {
    stuffSdBelow: 4.59955,
    shortGainSdBelow: 1.9267,
    bigPlaySdAbove: 1.97964,
    stuffYards: { min: -3, max: 0 },
    shortGainYards: { min: 1, max: 5 },
    bigPlayYards: { min: 9, max: 20 },
    normalYards: { min: 2, max: 9 },
    fumbleRate: 0.010,
  },
} as const;

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundInt(value: number): number {
  return Math.round(value);
}

export function fitOutcomes(input: FitInputs): FittedCoefficients {
  // Bands are accepted as input for forward compatibility with PR 2/3; in the
  // scaffolding phase coefficients are anchored to the measured distribution.
  // Reference the map to keep the parameter non-unused.
  if (input.bands.size === 0) {
    throw new Error("fitOutcomes requires a non-empty bands map");
  }

  const { scores } = input;
  const pc = FIT_CONFIG.pass;

  // Each probability coefficient has the form `prob = base ± score · modifier`
  // and must evaluate to `anchorAtMean` at the measured distribution mean.
  // Solve for `base` symbolically so future distribution shifts regenerate
  // coefficients without hand-retuning.
  const pass: PassCoefficients = {
    completion: {
      base: roundTo(
        pc.completion.anchorAtMean -
          scores.coverageScore.mean * pc.completion.modifier,
        4,
      ),
      coverageModifier: pc.completion.modifier,
      floor: pc.completion.floor,
      ceiling: pc.completion.ceiling,
    },
    interception: {
      base: roundTo(
        pc.interception.anchorAtMean +
          scores.coverageScore.mean * pc.interception.modifier,
        4,
      ),
      coverageModifier: pc.interception.modifier,
      floor: pc.interception.floor,
    },
    sack: {
      base: roundTo(
        pc.sack.anchorAtMean +
          scores.protectionScore.mean * pc.sack.modifier,
        4,
      ),
      protectionModifier: pc.sack.modifier,
      floor: pc.sack.floor,
    },
    bigPlay: {
      base: roundTo(
        pc.bigPlay.anchorAtMean -
          scores.coverageScore.mean * pc.bigPlay.modifier,
        4,
      ),
      coverageModifier: pc.bigPlay.modifier,
      floor: pc.bigPlay.floor,
      ceiling: pc.bigPlay.ceiling,
      yards: pc.bigPlay.yards,
    },
    completionYards: pc.completionYards,
    fumbleOnSack: pc.fumbleOnSack,
  };

  const rc = FIT_CONFIG.run;
  const m = scores.blockScore.mean;
  const sd = scores.blockScore.stddev;
  const run: RunCoefficients = {
    stuffThreshold: roundInt(m - rc.stuffSdBelow * sd),
    stuffYards: rc.stuffYards,
    shortGainThreshold: roundInt(m - rc.shortGainSdBelow * sd),
    shortGainYards: rc.shortGainYards,
    bigPlayThreshold: roundInt(m + rc.bigPlaySdAbove * sd),
    bigPlayYards: rc.bigPlayYards,
    normalYards: rc.normalYards,
    fumbleRate: rc.fumbleRate,
  };

  return { pass, run };
}
