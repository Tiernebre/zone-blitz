package app.zoneblitz.league.team;

import java.util.List;

public interface TeamRepository {

  /**
   * Insert all teams for a league in a single batch. Every team is seeded with the same {@code
   * staffBudgetCents} ceiling — v1 of the staff-market economy gives all teams an equal pool; the
   * parameter exists so the caller (league-creation service) names the constant at its own site
   * rather than having it buried in the repository.
   */
  void insertAll(long leagueId, List<TeamDraft> drafts, long staffBudgetCents);
}
