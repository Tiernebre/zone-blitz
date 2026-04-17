/**
 * Hidden scout ratings — the information engine inside the scouting
 * system. GMs never see these numbers directly; they drive the noise
 * and bias applied to every scouting report, and they leak only
 * through multi-draft track records.
 *
 * Values are 0–100 integers anchored to the same scale contract
 * `docs/product/north-star/player-attributes.md` describes for
 * players: 50 is the Geno Smith Line (usable starter / fringe
 * evaluator), 70+ is franchise-caliber, 85+ is elite, 95+ is
 * generational. Means cluster at 50 with a right-skewed bell.
 *
 * - `accuracy` — how close the scout's evaluations sit to the truth on
 *   current skill, before any positional specialty kicks in.
 * - `projection` — ability to forecast how much a prospect will grow.
 *   The scouting north-star doc calls this "the biggest source of
 *   scouting error", so it rolls independently of `accuracy`.
 * - `intangibleRead` — reading character, football IQ, composure, work
 *   ethic from interviews and background work.
 * - `confidenceCalibration` — how well their conviction grades match
 *   reality. Low values produce overconfident or underconfident scouts
 *   whose stated certainty doesn't track hit rate.
 * - `biasResistance` — resistance to the systematic biases the
 *   scouting doc describes: falling for combine warriors, overrating
 *   "his guys", anchoring to mock-draft consensus, etc.
 *
 * Each rating carries a `ceiling` that caps future growth — young
 * scouts sit well below theirs, veterans sit near it. `growthRate`
 * modulates how fast the gap closes each offseason.
 *
 * This table MUST NOT be joined into any public scout aggregate.
 */
export interface ScoutRatingValues {
  accuracy: number;
  projection: number;
  intangibleRead: number;
  confidenceCalibration: number;
  biasResistance: number;
}

export const SCOUT_RATING_KEYS: readonly (keyof ScoutRatingValues)[] = [
  "accuracy",
  "projection",
  "intangibleRead",
  "confidenceCalibration",
  "biasResistance",
] as const;

export interface ScoutRatings {
  scoutId: string;
  current: ScoutRatingValues;
  ceiling: ScoutRatingValues;
  growthRate: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScoutRatingsUpsertInput {
  scoutId: string;
  current: ScoutRatingValues;
  ceiling: ScoutRatingValues;
  growthRate: number;
}
