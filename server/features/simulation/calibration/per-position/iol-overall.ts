import type { PlayerAttributes } from "@zone-blitz/shared";

// Interior-OL (C, G) overall. Mirrors how `neutralBucket` classifies
// IOL (runBlocking + passBlocking + strength) and adds `awareness`-
// adjacent IQ attrs so inexperienced-but-athletic guards don't score
// the same as a veteran. Averaging gives a single 0-100 "IOL overall"
// that calibration buckets on: a 50-overall interior lineman should
// produce NFL median-starter numbers on the band metrics, 70 should
// be elite, etc.
export const IOL_OVERALL_ATTRS = [
  "passBlocking",
  "runBlocking",
  "strength",
  "footballIq",
] as const satisfies ReadonlyArray<keyof PlayerAttributes>;

export function iolOverall(attributes: PlayerAttributes): number {
  let sum = 0;
  for (const key of IOL_OVERALL_ATTRS) {
    sum += attributes[key];
  }
  return sum / IOL_OVERALL_ATTRS.length;
}
