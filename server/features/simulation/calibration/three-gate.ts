import type { MetricBand } from "./band-loader.ts";
import type { SimDistribution } from "./compute-distribution.ts";
import {
  K_MEAN,
  SPREAD_TOLERANCE,
  TAIL_SLACK_SD_MULTIPLIER,
} from "./constants.ts";

export type { SimDistribution } from "./compute-distribution.ts";

export interface MeanGateResult {
  passed: boolean;
  simValue: number;
  bandMean: number;
  threshold: number;
}

export interface SpreadGateResult {
  passed: boolean;
  simValue: number;
  lowerBound: number;
  upperBound: number;
}

export interface TailGateResult {
  passed: boolean;
  simP10: number;
  simP90: number;
  p10Floor: number;
  p90Ceiling: number;
}

export interface GateResult {
  metric: string;
  passed: boolean;
  meanGate: MeanGateResult;
  spreadGate: SpreadGateResult;
  tailGate: TailGateResult;
}

export function checkThreeGate(
  metric: string,
  band: MetricBand,
  sim: SimDistribution,
): GateResult {
  const meanThreshold = K_MEAN * band.sd / Math.sqrt(sim.n);
  const meanDiff = Math.abs(sim.mean - band.mean);
  const meanPassed = meanDiff <= meanThreshold;

  const spreadLower = (1 - SPREAD_TOLERANCE) * band.sd;
  const spreadUpper = (1 + SPREAD_TOLERANCE) * band.sd;
  const spreadPassed = sim.sd >= spreadLower && sim.sd <= spreadUpper;

  const tailSlack = TAIL_SLACK_SD_MULTIPLIER * band.sd;
  const p10Floor = band.p10 - tailSlack;
  const p90Ceiling = band.p90 + tailSlack;
  const tailPassed = sim.p10 >= p10Floor && sim.p90 <= p90Ceiling;

  return {
    metric,
    passed: meanPassed && spreadPassed && tailPassed,
    meanGate: {
      passed: meanPassed,
      simValue: sim.mean,
      bandMean: band.mean,
      threshold: meanThreshold,
    },
    spreadGate: {
      passed: spreadPassed,
      simValue: sim.sd,
      lowerBound: spreadLower,
      upperBound: spreadUpper,
    },
    tailGate: {
      passed: tailPassed,
      simP10: sim.p10,
      simP90: sim.p90,
      p10Floor,
      p90Ceiling,
    },
  };
}
