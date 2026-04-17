import type { PlayerAttributes } from "@zone-blitz/shared";

// Signature attributes for an S "overall" rating. The neutral-bucket
// classifier keys off zoneCoverage / tackling / footballIq /
// anticipation to tag a player as a safety; resolve-matchups ranks
// safeties by zoneCoverage / speed / tackling. We blend both sides so
// the calibration bucket captures the full safety skill set — ball
// skills (zoneCoverage, manCoverage, anticipation), range (speed), and
// run support (tackling). No `playRecognition` attribute exists on
// PlayerAttributes, so it's intentionally omitted.
export const S_OVERALL_ATTRS = [
  "zoneCoverage",
  "manCoverage",
  "speed",
  "tackling",
  "anticipation",
] as const satisfies ReadonlyArray<keyof PlayerAttributes>;

export function sOverall(attributes: PlayerAttributes): number {
  let sum = 0;
  for (const key of S_OVERALL_ATTRS) {
    sum += attributes[key];
  }
  return sum / S_OVERALL_ATTRS.length;
}
