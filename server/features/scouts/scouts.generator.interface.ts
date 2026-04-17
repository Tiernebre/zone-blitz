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
 * A scout record as produced by the generator — the public shape ready
 * for insertion into the `scouts` table plus the hidden `ratings`
 * bundle the service persists into `scout_ratings`. `id` is
 * pre-assigned so `reportsToId` can reference siblings without a
 * post-insert stitching pass.
 */
export type GeneratedScout =
  & Omit<Scout, "createdAt" | "updatedAt">
  & { ratings: GeneratedScoutRatings };

export interface ScoutsGenerator {
  generate(input: ScoutsGeneratorInput): GeneratedScout[];
  generatePool(input: ScoutsPoolInput): GeneratedScout[];
}
