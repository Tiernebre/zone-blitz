import type { PlayerAttributes } from "@zone-blitz/shared";

// The five attributes we use to compute a single 0-100 "TE overall"
// for calibration bucketing. The neutral-bucket classifier signature
// is just `catching`, `runBlocking`, `passBlocking` (three attrs) —
// enough to separate TEs from WRs/IOL at generation time, but too
// narrow for calibration: two modern NFL TEs with the same catching
// can still be leagues apart on separation/YAC.
//
// We add `routeRunning` (separation on routes) and `speed` (YAC and
// vertical seam threat) so the overall tracks what actually drives
// receiving production — the thing the NFL bands measure. Blocking is
// kept in the mix because a pure receiver TE who can't block gets
// scheme-limited in the real game, and the sim reflects that via
// run_block matchups. `strength` was considered but it largely
// duplicates the signal from runBlocking, so leaving it out keeps
// the overall balanced 3:2 in favor of receiving.
export const TE_OVERALL_ATTRS = [
  "routeRunning",
  "catching",
  "runBlocking",
  "passBlocking",
  "speed",
] as const satisfies ReadonlyArray<keyof PlayerAttributes>;

export function teOverall(attributes: PlayerAttributes): number {
  let sum = 0;
  for (const key of TE_OVERALL_ATTRS) {
    sum += attributes[key];
  }
  return sum / TE_OVERALL_ATTRS.length;
}
