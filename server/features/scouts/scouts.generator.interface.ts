import type { Scout, ScoutRatingValues } from "@zone-blitz/shared";

export interface ScoutsGeneratorInput {
  leagueId: string;
  teamIds: string[];
}

export interface ScoutsPoolInput {
  leagueId: string;
  numberOfTeams: number;
}

/**
 * Hidden ratings rolled alongside every scout. The service routes this
 * to the `scout_ratings` repository; the `scouts` insert itself never
 * sees these numbers.
 */
export interface GeneratedScoutRatings {
  current: ScoutRatingValues;
  ceiling: ScoutRatingValues;
  growthRate: number;
}

/**
 * Hidden personality-trait payload emitted for every scout. Modeled on
 * the coach/player personality scheme. These are distinct from the
 * hiring `*Pref` weights — those drive offer evaluation; personality
 * drives post-hire behavior (re-sign decisions, conviction on the
 * board, travel patterns, early exits).
 *
 * All values are 0–100 on the league-wide rating scale (midpoint 50),
 * rolled once at generation and stable per scout. Scheme attachment is
 * deliberately omitted — scouts evaluate players, not schemes.
 *
 * - `loyalty` — org attachment; loyal scouts take discounts to stay.
 * - `greed` — weight on compensation.
 * - `ambition` — drive to reach the director chair.
 * - `conviction` — willingness to stick with a bold evaluation against
 *   the board vs. conforming to consensus. High-conviction scouts find
 *   sleepers and get fired for whiffs; low-conviction scouts play it
 *   safe.
 * - `travelTolerance` — willingness to grind cross-country schedules.
 *   Affects regional-focus stickiness and `workCapacity` utilization.
 */
export interface GeneratedScoutPersonality {
  loyalty: number;
  greed: number;
  ambition: number;
  conviction: number;
  travelTolerance: number;
}

/**
 * A scout record as produced by the generator — the public shape ready
 * for insertion into the `scouts` table plus the hidden `ratings`
 * bundle the service persists into `scout_ratings`. `id` is
 * pre-assigned so `reportsToId` can reference siblings without a
 * post-insert stitching pass.
 */
export type GeneratedScout =
  & Omit<Scout, "createdAt" | "updatedAt">
  & {
    ratings: GeneratedScoutRatings;
    personality: GeneratedScoutPersonality;
  };

export interface ScoutsGenerator {
  generate(input: ScoutsGeneratorInput): GeneratedScout[];
  generatePool(input: ScoutsPoolInput): GeneratedScout[];
}
