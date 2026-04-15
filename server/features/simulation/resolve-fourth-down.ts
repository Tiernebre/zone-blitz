import type { SeededRng } from "./rng.ts";

export type FourthDownDecision = "go" | "fg" | "punt";

export interface FourthDownInput {
  yardsToEndzone: number;
  distance: number;
  scoreDifferential: number;
  quarter: 1 | 2 | 3 | 4 | "OT";
  clockSeconds: number;
  aggressiveness: number;
}

type FieldZone =
  | "own_deep"
  | "own_40_to_50"
  | "opp_40_to_50"
  | "opp_30_to_40"
  | "opp_red_zone_outer"
  | "opp_red_zone_inner";

type DistanceBucket = "short_1_2" | "medium_3_5" | "long_6_plus";

const BASE_GO_RATES: Record<FieldZone, Record<DistanceBucket, number>> = {
  own_deep: { short_1_2: 0.253, medium_3_5: 0.074, long_6_plus: 0.048 },
  own_40_to_50: { short_1_2: 0.497, medium_3_5: 0.123, long_6_plus: 0.086 },
  opp_40_to_50: { short_1_2: 0.798, medium_3_5: 0.360, long_6_plus: 0.118 },
  opp_30_to_40: { short_1_2: 0.805, medium_3_5: 0.431, long_6_plus: 0.142 },
  opp_red_zone_outer: {
    short_1_2: 0.630,
    medium_3_5: 0.195,
    long_6_plus: 0.097,
  },
  opp_red_zone_inner: {
    short_1_2: 0.702,
    medium_3_5: 0.191,
    long_6_plus: 0.076,
  },
};

function getFieldZone(yardsToEndzone: number): FieldZone {
  if (yardsToEndzone <= 20) return "opp_red_zone_inner";
  if (yardsToEndzone <= 30) return "opp_red_zone_outer";
  if (yardsToEndzone <= 40) return "opp_30_to_40";
  if (yardsToEndzone <= 50) return "opp_40_to_50";
  if (yardsToEndzone <= 60) return "own_40_to_50";
  return "own_deep";
}

function getDistanceBucket(distance: number): DistanceBucket {
  if (distance <= 2) return "short_1_2";
  if (distance <= 5) return "medium_3_5";
  return "long_6_plus";
}

function isInFieldGoalRange(yardsToEndzone: number): boolean {
  return yardsToEndzone + 17 <= 55;
}

export function resolveFourthDown(
  input: FourthDownInput,
  rng: SeededRng,
): FourthDownDecision {
  const zone = getFieldZone(input.yardsToEndzone);
  const bucket = getDistanceBucket(input.distance);
  let goRate = BASE_GO_RATES[zone][bucket];

  const aggrMultiplier = 0.5 + input.aggressiveness / 100;
  goRate *= aggrMultiplier;

  const isLateGame = input.quarter === "OT" || input.quarter >= 3;
  if (isLateGame && input.scoreDifferential < 0) {
    const deficit = Math.abs(input.scoreDifferential);
    const timeLeft = input.quarter === 4 || input.quarter === "OT"
      ? input.clockSeconds
      : input.clockSeconds + 900;
    const urgency = Math.min(deficit / 21, 1) *
      Math.max(0, 1 - timeLeft / 1800);
    goRate += urgency * 0.3;
  }

  goRate = Math.max(0, Math.min(1, goRate));

  const roll = rng.next();

  if (roll < goRate) return "go";
  if (isInFieldGoalRange(input.yardsToEndzone)) return "fg";
  return "punt";
}
