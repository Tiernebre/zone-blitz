package app.zoneblitz.league.team;

import java.util.List;

public interface TeamRepository {

  /** Insert all teams for a league in a single batch. */
  void insertAll(long leagueId, List<TeamDraft> drafts);
}
