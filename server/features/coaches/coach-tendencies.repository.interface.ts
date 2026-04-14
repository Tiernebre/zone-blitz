import type {
  CoachTendencies,
  CoachTendenciesUpsertInput,
} from "@zone-blitz/shared";

export interface CoachTendenciesRepository {
  /**
   * Returns the stored tendency vector for a coach, or `undefined` when
   * the coach has no row (non-coordinators typically won't). The
   * returned value collapses offensive/defensive columns into their
   * respective sub-vectors; a side is `null` when every column on that
   * side is null.
   */
  getByCoachId(coachId: string): Promise<CoachTendencies | undefined>;

  /**
   * Inserts or updates the tendency row for a coach. Columns not
   * provided in `input` are left null on insert and untouched on update,
   * so the caller can populate offensive and defensive sides
   * independently without overwriting the other.
   */
  upsert(input: CoachTendenciesUpsertInput): Promise<CoachTendencies>;
}
