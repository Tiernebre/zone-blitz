import type { PlayerAttributes } from "@zone-blitz/shared";

// The six signature attributes that `neutralBucket` uses to classify
// a player as QB. Averaging them gives a single 0-100 "QB overall"
// that we can bucket on for calibration: a 50-overall QB should
// produce median NFL starter numbers, 70 should be elite, etc.
export const QB_OVERALL_ATTRS = [
  "armStrength",
  "accuracyShort",
  "accuracyMedium",
  "accuracyDeep",
  "release",
  "decisionMaking",
] as const satisfies ReadonlyArray<keyof PlayerAttributes>;

export function qbOverall(attributes: PlayerAttributes): number {
  let sum = 0;
  for (const key of QB_OVERALL_ATTRS) {
    sum += attributes[key];
  }
  return sum / QB_OVERALL_ATTRS.length;
}
