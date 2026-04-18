package app.zoneblitz.league;

import java.util.List;

public interface ListLeaguesForUser {

  /**
   * Return every league owned by {@code ownerSubject}, most-recent first, each paired with the
   * user's controlled franchise. Returns an empty list if the user has no leagues.
   */
  List<LeagueSummary> listFor(String ownerSubject);
}
