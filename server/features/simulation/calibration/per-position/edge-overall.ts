import type { PlayerAttributes } from "@zone-blitz/shared";

// The signature attributes that define EDGE-rusher quality in the sim.
// `resolve-matchups.ts` ranks edge rushers by
// `RANKING_ATTRS.passRush` = [passRushing, acceleration, strength],
// which is the pass-rush side of the position. We add `blockShedding`
// and `runDefense` here so the "overall" reflects complete EDGE play
// (pass-rush + run-defense), matching how NFL front offices evaluate
// the position — a great pass rusher who can't set the edge on runs
// is a role player, not a starter.
//
// Averaging all five gives a single 0-100 "EDGE overall" we can bucket
// on for calibration: a 50-overall edge should land on NFL median
// starter numbers (sacks/qb_hits/tfl per game), 70+ is elite.
export const EDGE_OVERALL_ATTRS = [
  "passRushing",
  "acceleration",
  "strength",
  "blockShedding",
  "runDefense",
] as const satisfies ReadonlyArray<keyof PlayerAttributes>;

export function edgeOverall(attributes: PlayerAttributes): number {
  let sum = 0;
  for (const key of EDGE_OVERALL_ATTRS) {
    sum += attributes[key];
  }
  return sum / EDGE_OVERALL_ATTRS.length;
}
