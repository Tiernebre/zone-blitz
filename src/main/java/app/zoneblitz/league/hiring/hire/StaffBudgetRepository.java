package app.zoneblitz.league.hiring.hire;

import app.zoneblitz.league.hiring.StaffBudget;

/** Feature-internal seam deriving a team's staff budget state for a given season. */
public interface StaffBudgetRepository {

  /**
   * Compute the budget snapshot for {@code teamId} in {@code season}. {@code budgetCents} is read
   * from {@code teams.staff_budget_cents}; {@code committedCents} is derived as:
   *
   * <pre>
   * committed = SUM(apy_cents) for active staff_contracts where
   *               season IN [start_season, end_season]
   *               AND (terminated_at_season IS NULL OR season &lt;= terminated_at_season)
   *           + SUM(offer_apy_cents) for candidate_offers in status ACTIVE or COUNTER_PENDING
   *               belonging to the team
   *           + SUM(dead_cap) for terminated contracts, where per-season dead cap is
   *               guarantee_cents / contract_years, spread across
   *               [terminated_at_season + 1, end_season]
   * </pre>
   */
  StaffBudget committed(long teamId, int season);
}
