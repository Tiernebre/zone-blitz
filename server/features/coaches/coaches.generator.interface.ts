import type { Coach } from "@zone-blitz/shared";

export interface CoachesGeneratorInput {
  leagueId: string;
  teamIds: string[];
  /**
   * Optional pool of college ids used to assign `collegeId` to generated
   * coaches. When empty, coaches are generated with `collegeId: null`.
   */
  collegeIds?: string[];
}

/**
 * A coach record as produced by the generator — the shape of a row ready
 * for insertion into the `coaches` table. `id` is pre-assigned so that
 * `reportsToId` and `mentorCoachId` can reference siblings without a
 * post-insert stitching pass.
 */
export type GeneratedCoach = Omit<Coach, "createdAt" | "updatedAt">;

export interface CoachesGenerator {
  generate(input: CoachesGeneratorInput): GeneratedCoach[];
}
