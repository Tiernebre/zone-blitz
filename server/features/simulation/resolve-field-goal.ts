import type { SeededRng } from "./rng.ts";
import type { PlayerRuntime } from "./resolve-play.ts";

export type FieldGoalOutcome = "made" | "missed" | "blocked";

export interface FieldGoalResult {
  outcome: FieldGoalOutcome;
  distance: number;
  blocked: boolean;
  returnToSpotOfKick: boolean;
  defenseYardLine: number;
}

export interface FieldGoalInput {
  kicker: PlayerRuntime;
  yardLine: number;
  weatherPenalty?: number;
  rng: SeededRng;
}

// ── Field-goal calibration knobs ──────────────────────────────────────
const FG_SNAP_DISTANCE = 17;
const FG_TOUCHBACK_YARD_LINE = 20;
const FG_RETURN_TO_SPOT_THRESHOLD = 50;

const FG_BLOCK = {
  floor: 0.005,
  base: 0.04,
  accuracyScale: 0.02,
  powerScale: 0.01,
} as const;

const FG_SUCCESS_BANDS = [
  { maxDistance: 27, base: 0.90, accuracyBonus: 0.08, powerBonus: 0 },
  { maxDistance: 37, base: 0.80, accuracyBonus: 0.12, powerBonus: 0 },
  { maxDistance: 47, base: 0.65, accuracyBonus: 0.15, powerBonus: 0.05 },
  { maxDistance: 52, base: 0.45, accuracyBonus: 0.2, powerBonus: 0.1 },
  { maxDistance: Infinity, base: 0.30, accuracyBonus: 0.15, powerBonus: 0.15 },
] as const;

const FG_SUCCESS_FLOOR = 0.01;
const FG_SUCCESS_CEILING = 0.99;

function getSuccessProbability(
  distance: number,
  kickingAccuracy: number,
  kickingPower: number,
  weatherPenalty: number,
): number {
  const accuracyFactor = kickingAccuracy / 100;
  const powerFactor = kickingPower / 100;

  const band = FG_SUCCESS_BANDS.find((b) => distance <= b.maxDistance)!;
  const baseProb = band.base + accuracyFactor * band.accuracyBonus +
    powerFactor * band.powerBonus;

  return Math.max(
    FG_SUCCESS_FLOOR,
    Math.min(FG_SUCCESS_CEILING, baseProb - weatherPenalty),
  );
}

export function resolveFieldGoal(input: FieldGoalInput): FieldGoalResult {
  const { kicker, yardLine, weatherPenalty = 0, rng } = input;
  const distance = 100 - yardLine + FG_SNAP_DISTANCE;
  const defenseYardLine = Math.max(FG_TOUCHBACK_YARD_LINE, 100 - yardLine);

  const kickingAccuracy =
    (kicker.attributes as unknown as Record<string, number>).kickingAccuracy ??
      50;
  const kickingPower =
    (kicker.attributes as unknown as Record<string, number>).kickingPower ?? 50;

  const blockChance = Math.max(
    FG_BLOCK.floor,
    FG_BLOCK.base - (kickingAccuracy / 100) * FG_BLOCK.accuracyScale -
      (kickingPower / 100) * FG_BLOCK.powerScale,
  );
  if (rng.next() < blockChance) {
    return {
      outcome: "blocked",
      distance,
      blocked: true,
      returnToSpotOfKick: true,
      defenseYardLine,
    };
  }

  const successProb = getSuccessProbability(
    distance,
    kickingAccuracy,
    kickingPower,
    weatherPenalty,
  );

  if (rng.next() < successProb) {
    return {
      outcome: "made",
      distance,
      blocked: false,
      returnToSpotOfKick: false,
      defenseYardLine,
    };
  }

  const returnToSpotOfKick = distance >= FG_RETURN_TO_SPOT_THRESHOLD;
  return {
    outcome: "missed",
    distance,
    blocked: false,
    returnToSpotOfKick,
    defenseYardLine,
  };
}
