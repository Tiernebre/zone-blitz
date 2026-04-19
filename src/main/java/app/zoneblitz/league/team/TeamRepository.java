package app.zoneblitz.league;

import java.util.List;

interface TeamRepository {

  /** Insert all teams for a league in a single batch. */
  void insertAll(long leagueId, List<TeamDraft> drafts);
}
