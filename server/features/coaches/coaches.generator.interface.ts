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
  };

export interface CoachesGenerator {
  generate(input: CoachesGeneratorInput): GeneratedCoach[];
  generatePool(input: CoachesPoolInput): GeneratedCoach[];
}
