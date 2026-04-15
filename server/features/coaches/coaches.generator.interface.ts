import type {
  Coach,
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
 * non-coordinator roles per ADR 0007 (v1 ships OC + DC only). The
 * service lifts this off the row before inserting into `coaches` and
 * upserts it into `coach_tendencies`.
 */
export interface GeneratedCoachTendencies {
  offense?: OffensiveTendencies;
  defense?: DefensiveTendencies;
}

/**
 * A coach record as produced by the generator — the shape of a row ready
 * for insertion into the `coaches` table. `id` is pre-assigned so that
 * `reportsToId` and `mentorCoachId` can reference siblings without a
 * post-insert stitching pass.
 */
export type GeneratedCoach =
  & Omit<Coach, "createdAt" | "updatedAt">
  & { tendencies?: GeneratedCoachTendencies };

export interface CoachesGenerator {
  generate(input: CoachesGeneratorInput): GeneratedCoach[];
  generatePool(input: CoachesPoolInput): GeneratedCoach[];
}
