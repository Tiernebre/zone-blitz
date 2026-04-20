package app.zoneblitz.league.hiring;

/**
 * Snapshot of a team's staff budget state in a given season. {@code budgetCents} is the ceiling
 * (from {@code teams.staff_budget_cents}); {@code committedCents} is derived from active contracts,
 * outstanding offers, and dead cap.
 */
record StaffBudget(long teamId, int season, long budgetCents, long committedCents) {

  /** Dollars (in cents) still available to spend before blowing the budget. */
  long availableCents() {
    return budgetCents - committedCents;
  }

  /** Whether adding {@code additionalCents} of commitment stays within the budget. */
  boolean canAfford(long additionalCents) {
    return committedCents + additionalCents <= budgetCents;
  }
}
