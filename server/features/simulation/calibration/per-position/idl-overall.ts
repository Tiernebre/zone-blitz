import type { PlayerAttributes } from "@zone-blitz/shared";

// Signature attributes that drive interior-DL impact in the engine.
// `neutralBucket` classifies a player as IDL from
// (strength, blockShedding, runDefense, passRushing); we add `tackling`
// so the overall also captures finishing at the line of scrimmage,
// which matters for the TFL / tackle counts the NFL reference bands
// track. Five attributes keep the overall balanced between rush
// (passRushing), anchor (strength, blockShedding), stopping runs
// (runDefense), and wrapping up ball-carriers (tackling).
export const IDL_OVERALL_ATTRS = [
  "passRushing",
  "strength",
  "blockShedding",
  "runDefense",
  "tackling",
] as const satisfies ReadonlyArray<keyof PlayerAttributes>;

export function idlOverall(attributes: PlayerAttributes): number {
  let sum = 0;
  for (const key of IDL_OVERALL_ATTRS) {
    sum += attributes[key];
  }
  return sum / IDL_OVERALL_ATTRS.length;
}
