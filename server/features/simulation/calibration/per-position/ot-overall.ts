import type { PlayerAttributes } from "@zone-blitz/shared";

// Signature attributes that make an OT effective. Starts from the
// `RANKING_ATTRS.blocking` set used by `resolve-matchups.ts`
// (passBlocking, runBlocking, strength) and adds `agility` (lateral
// movement / kick-slide quality) and `footballIq` (recognition of
// stunts/blitzes — the attribute library does not expose an explicit
// "awareness" attribute, so footballIq stands in as the mental anchor).
// Averaging these gives a single 0-100 "OT overall" that we can bucket
// on for calibration: a 50-overall OT should produce median NFL
// starter proxy numbers, 70 should be elite, etc.
export const OT_OVERALL_ATTRS = [
  "passBlocking",
  "runBlocking",
  "strength",
  "agility",
  "footballIq",
] as const satisfies ReadonlyArray<keyof PlayerAttributes>;

export function otOverall(attributes: PlayerAttributes): number {
  let sum = 0;
  for (const key of OT_OVERALL_ATTRS) {
    sum += attributes[key];
  }
  return sum / OT_OVERALL_ATTRS.length;
}
