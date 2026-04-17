import type { PlayerAttributes } from "@zone-blitz/shared";

// The four signature attributes `resolve-matchups.ts` ranks CBs on
// (RANKING_ATTRS.coverage = manCoverage, zoneCoverage, speed), plus
// agility — a staple for closing on routes and flipping hips. The
// mean of these gives a single 0-100 "CB overall" we can bucket on
// for calibration: a 50-overall CB should land on the NFL median
// starter's pass-defense production, 70+ is elite.
export const CB_OVERALL_ATTRS = [
  "manCoverage",
  "zoneCoverage",
  "speed",
  "agility",
] as const satisfies ReadonlyArray<keyof PlayerAttributes>;

export function cbOverall(attributes: PlayerAttributes): number {
  let sum = 0;
  for (const key of CB_OVERALL_ATTRS) {
    sum += attributes[key];
  }
  return sum / CB_OVERALL_ATTRS.length;
}
