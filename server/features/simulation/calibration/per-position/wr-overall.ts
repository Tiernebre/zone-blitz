import type { PlayerAttributes } from "@zone-blitz/shared";

// The four signature attributes that `neutralBucket` uses to classify a
// player as WR, plus the pairing with `RANKING_ATTRS.receiver` in
// `resolve-matchups.ts` (`routeRunning`, `speed`, `catching`) and the
// archetype signature (`routeRunning`, `catching`, `speed`,
// `acceleration`). Averaging the four gives a single 0-100 "WR overall"
// we can bucket on for calibration: a 50-overall WR should produce
// median NFL starter numbers, 70 should be elite, etc.
export const WR_OVERALL_ATTRS = [
  "routeRunning",
  "catching",
  "speed",
  "release",
] as const satisfies ReadonlyArray<keyof PlayerAttributes>;

export function wrOverall(attributes: PlayerAttributes): number {
  let sum = 0;
  for (const key of WR_OVERALL_ATTRS) {
    sum += attributes[key];
  }
  return sum / WR_OVERALL_ATTRS.length;
}
