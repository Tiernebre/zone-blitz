/**
 * Hidden coach ratings. GMs never see these numbers directly — they
 * drive simulation outcomes and leak through noisy interview signals.
 * Values are 0–100 integers.
 *
 * - `leadership` — locker room, staff retention, culture (HC-weighted)
 * - `gameManagement` — 4th-down decisions, clock, timeout/challenge use
 * - `schemeMastery` — fidelity of tendency execution under pressure
 * - `playerDevelopment` — offseason growth for young players in the room
 * - `adaptability` — mid-game and multi-season adjustments
 *
 * Each rating has a `ceiling` that caps future growth. Young coaches
 * carry wider current/ceiling gaps; veterans sit near their ceiling.
 * `growthRate` modulates how quickly a coach closes that gap each
 * offseason (also modulated by mentor, results, and age in later slices).
 *
 * These values MUST NOT be joined into the public `CoachDetail`
 * aggregate. The only path to them is via the simulation layer and the
 * interview scouting layer that leaks noisy reads.
 */

export interface CoachRatingValues {
  leadership: number;
  gameManagement: number;
  schemeMastery: number;
  playerDevelopment: number;
  adaptability: number;
}

export const COACH_RATING_KEYS: readonly (keyof CoachRatingValues)[] = [
  "leadership",
  "gameManagement",
  "schemeMastery",
  "playerDevelopment",
  "adaptability",
] as const;

export interface CoachRatings {
  coachId: string;
  current: CoachRatingValues;
  ceiling: CoachRatingValues;
  growthRate: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoachRatingsUpsertInput {
  coachId: string;
  current: CoachRatingValues;
  ceiling: CoachRatingValues;
  growthRate: number;
}
