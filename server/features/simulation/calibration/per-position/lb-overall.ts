import type { PlayerAttributes } from "@zone-blitz/shared";

// The LB overall is the mean of the off-ball linebacker's signature
// attributes. `neutralBucket` already classifies a player as LB using
// `tackling`, `runDefense`, `zoneCoverage`, and `footballIq`, and
// `resolve-matchups.ts` ranks LBs for run-defense via the shared
// `runDefense` attr set (`blockShedding`, `tackling`, `runDefense`).
//
// The LB bands (from `per-position-lb.R`) carve off-ball LBs on a
// composite of tackles/gm + TFL/gm + PBU/gm — which is a mix of
// run-fit (`blockShedding`, `tackling`, `runDefense`) and coverage
// playmaking (`zoneCoverage`, `anticipation`). We average all six so
// the 50-overall bucket lines up with the NFL median starter across
// both facets of the role. A pure run-defense overall would bias the
// bucket toward downhill thumpers and understate coverage LBs.
export const LB_OVERALL_ATTRS = [
  "blockShedding",
  "tackling",
  "runDefense",
  "zoneCoverage",
  "footballIq",
  "anticipation",
] as const satisfies ReadonlyArray<keyof PlayerAttributes>;

export function lbOverall(attributes: PlayerAttributes): number {
  let sum = 0;
  for (const key of LB_OVERALL_ATTRS) {
    sum += attributes[key];
  }
  return sum / LB_OVERALL_ATTRS.length;
}
