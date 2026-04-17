import type { CoachRatingValues } from "@zone-blitz/shared";
import { clamp } from "@zone-blitz/shared";
import type { CoachingMods } from "./resolve-play.ts";

/**
 * Maps hidden coach ratings to simulation `CoachingMods`. League-average
 * (rating 50 across the board) reproduces the pre-ratings baseline so
 * calibration bands stay intact; elite and poor coaches spread symmetrically
 * around that midpoint. See `docs/product/north-star/coaches.md` and the
 * rating-scale contract in `player-attributes.md` — 50 is the midpoint.
 *
 * Split intentionally keeps coaching's total sim leverage small (~20%):
 *  - schemeMastery  → schemeFitBonus   (OC/DC avg)
 *  - adaptability   → situationalBonus (HC + coords avg)
 *  - gameManagement → aggressiveness   (HC)
 *  - leadership     → penaltyDiscipline (HC, lower = fewer flags)
 *
 * Unused here on purpose: `playerDevelopment` — that's an offseason growth
 * lever, not a game-day one.
 */
export interface CoachStaffRatings {
  hc?: CoachRatingValues;
  oc?: CoachRatingValues;
  dc?: CoachRatingValues;
}

const NEUTRAL: CoachRatingValues = {
  leadership: 50,
  gameManagement: 50,
  schemeMastery: 50,
  playerDevelopment: 50,
  adaptability: 50,
};

function avg(values: number[]): number {
  if (values.length === 0) return 50;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Team-level mod derivation. Caller decides which staff belongs to which
 * side (offense/defense) — this function just translates a staff trio into
 * the shared `CoachingMods` shape.
 */
export function coachRatingsToMods(staff: CoachStaffRatings): CoachingMods {
  const hc = staff.hc ?? NEUTRAL;
  const oc = staff.oc ?? NEUTRAL;
  const dc = staff.dc ?? NEUTRAL;

  // schemeFitBonus: midpoint 2.5, range [0, 5]. Each 10 rating points ≈ 0.5.
  const schemeDelta = avg([oc.schemeMastery, dc.schemeMastery]) - 50;
  const schemeFitBonus = clamp(2.5 + schemeDelta * 0.05, 0, 5);

  // situationalBonus: midpoint 1.5, range [0, 3]. Each 10 points ≈ 0.3.
  const adaptDelta = avg([hc.adaptability, oc.adaptability, dc.adaptability]) -
    50;
  const situationalBonus = clamp(1.5 + adaptDelta * 0.03, 0, 3);

  // aggressiveness: midpoint 50, range [30, 70]. Each 10 points ≈ 4.
  const aggressiveness = clamp(50 + (hc.gameManagement - 50) * 0.4, 30, 70);

  // penaltyDiscipline: midpoint 1.0, range [0.85, 1.15]. Leadership +30 → ~0.91.
  // Inverted: higher leadership lowers the multiplier (fewer flags).
  const penaltyDiscipline = clamp(
    1 - (hc.leadership - 50) * 0.003,
    0.85,
    1.15,
  );

  return {
    schemeFitBonus,
    situationalBonus,
    aggressiveness,
    penaltyDiscipline,
  };
}
