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

function getSuccessProbability(
  distance: number,
  kickingAccuracy: number,
  kickingPower: number,
  weatherPenalty: number,
): number {
  const accuracyFactor = kickingAccuracy / 100;
  const powerFactor = kickingPower / 100;

  let baseProb: number;
  if (distance <= 27) {
    baseProb = 0.90 + accuracyFactor * 0.08;
  } else if (distance <= 37) {
    baseProb = 0.80 + accuracyFactor * 0.12;
  } else if (distance <= 47) {
    baseProb = 0.65 + accuracyFactor * 0.15 + powerFactor * 0.05;
  } else if (distance <= 52) {
    baseProb = 0.45 + accuracyFactor * 0.2 + powerFactor * 0.1;
  } else {
    baseProb = 0.30 + accuracyFactor * 0.15 + powerFactor * 0.15;
  }

  return Math.max(0.01, Math.min(0.99, baseProb - weatherPenalty));
}

export function resolveFieldGoal(input: FieldGoalInput): FieldGoalResult {
  const { kicker, yardLine, weatherPenalty = 0, rng } = input;
  const distance = 100 - yardLine + 17;
  const defenseYardLine = Math.max(20, 100 - yardLine);

  const kickingAccuracy =
    (kicker.attributes as unknown as Record<string, number>).kickingAccuracy ??
      50;
  const kickingPower =
    (kicker.attributes as unknown as Record<string, number>).kickingPower ?? 50;

  const blockChance = Math.max(
    0.005,
    0.04 - (kickingAccuracy / 100) * 0.02 - (kickingPower / 100) * 0.01,
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

  const returnToSpotOfKick = distance >= 50;
  return {
    outcome: "missed",
    distance,
    blocked: false,
    returnToSpotOfKick,
    defenseYardLine,
  };
}
