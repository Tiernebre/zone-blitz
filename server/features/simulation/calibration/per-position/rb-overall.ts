import type { PlayerAttributes } from "@zone-blitz/shared";

// The four signature attributes `neutralBucket` uses to classify a
// player as RB. Averaging them gives a single 0-100 "RB overall" we
// can bucket on for calibration: a 50-overall RB should land on the
// NFL median starter's YPC / TD rate, 70+ is elite.
export const RB_OVERALL_ATTRS = [
  "ballCarrying",
  "elusiveness",
  "acceleration",
  "speed",
] as const satisfies ReadonlyArray<keyof PlayerAttributes>;

export function rbOverall(attributes: PlayerAttributes): number {
  let sum = 0;
  for (const key of RB_OVERALL_ATTRS) {
    sum += attributes[key];
  }
  return sum / RB_OVERALL_ATTRS.length;
}
