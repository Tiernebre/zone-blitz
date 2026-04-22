package app.zoneblitz.league.cap;

/** Feature-internal seam that fetches the raw staff-cap breakdown for a team in a given season. */
interface StaffCapBreakdownRepository {

  /**
   * Load the cap ceiling and line items contributing to the team's committed cap in {@code season}:
   * active staff contracts, outstanding candidate offers (ACTIVE or COUNTER_PENDING), and dead-cap
   * rows from terminated contracts whose remaining guarantee still applies. Returns a breakdown
   * with {@code budgetCents = 0} and empty lists when {@code teamId} does not exist.
   */
  StaffCapBreakdown breakdown(long teamId, int season);
}
