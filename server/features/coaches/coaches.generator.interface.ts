import type {
  Coach,
  CoachRatingValues,
  DefensiveTendencies,
  OffensiveTendencies,
} from "@zone-blitz/shared";

export interface CoachesGeneratorInput {
  leagueId: string;
  teamIds: string[];
  /**
   * Optional pool of college ids used to assign `collegeId` to generated
   * coaches. When empty, coaches are generated with `collegeId: null`.
   */
  collegeIds?: string[];
}

export interface CoachesPoolInput {
  leagueId: string;
  numberOfTeams: number;
  collegeIds?: string[];
}

/**
 * Optional tendency payload emitted for coaches who carry a scheme
 * identity — OCs populate `offense`, DCs populate `defense`. Absent on
 * non-coordinator roles (v1 ships OC + DC only). The
 * service lifts this off the row before inserting into `coaches` and
 * upserts it into `coach_tendencies`.
 */
export interface GeneratedCoachTendencies {
  offense?: OffensiveTendencies;
  defense?: DefensiveTendencies;
}

/**
 * Hidden rating payload emitted for every coach. `current` is the
 * present-day skill level; `ceiling` is the peak the coach can reach
 * with growth — young coaches start with a wide gap, veterans sit near
 * theirs. `growthRate` (0–100) modulates how fast the gap closes each
 * offseason. These numbers never surface publicly; the service upserts
 * them into `coach_ratings` and the sim/interview layers read them.
 */
export interface GeneratedCoachRatings {
  current: CoachRatingValues;
  ceiling: CoachRatingValues;
  growthRate: number;
}

/**
 * Hidden personality-trait payload emitted for every coach. Modeled on
 * the player-attribute personality scheme (see
 * `docs/product/north-star/player-attributes.md`). These are NOT the
 * same as the hiring `*Pref` weights — those drive how a coach evaluates
 * an offer; personality drives post-hire behavior: re-sign decisions,
 * early exits, media incidents, locker-room culture.
 *
 * All values are 0–100 on the league-wide rating scale (midpoint 50),
 * rolled once at generation and stable per coach. Traits are hidden —
 * only interviews surface noisy signals.
 *
 * - `loyalty` — weight on staying with the current org vs. taking the
 *   best offer. High-loyalty coaches discount to stay; low-loyalty
 *   treat hiring as a transaction.
 * - `greed` — weight on compensation relative to other factors.
 * - `ambition` — drive to reach HC / GM chair. High-ambition
 *   coordinators chase HC interviews; low-ambition lifers settle in.
 * - `schemeAttachment` — resistance to transitioning from the coach's
 *   native scheme (a Shanahan-tree OC offered an Air Raid job).
 * - `ego` — media sensitivity, locker-room dynamics, post-loss
 *   reaction.
 * - `workaholic` — willingness to do "football 24/7" vs. walking away
 *   for family. High values → McDaniels archetype; low values →
 *   early-retirement / Dungy archetype risk.
 */
export interface GeneratedCoachPersonality {
  loyalty: number;
  greed: number;
  ambition: number;
  schemeAttachment: number;
  ego: number;
  workaholic: number;
}

/**
 * A coach record as produced by the generator — the shape of a row ready
 * for insertion into the `coaches` table. `id` is pre-assigned so that
 * `reportsToId` and `mentorCoachId` can reference siblings without a
 * post-insert stitching pass.
 */
export type GeneratedCoach =
  & Omit<Coach, "createdAt" | "updatedAt">
  & {
    tendencies?: GeneratedCoachTendencies;
    ratings: GeneratedCoachRatings;
    personality: GeneratedCoachPersonality;
  };

export interface CoachesGenerator {
  generate(input: CoachesGeneratorInput): GeneratedCoach[];
  generatePool(input: CoachesPoolInput): GeneratedCoach[];
}
