package app.zoneblitz.league;

import java.util.Optional;

/** Fetches a single league the given user owns. */
public interface GetLeague {

  /**
   * @return the league summary if one with {@code id} exists and is owned by {@code ownerSubject};
   *     empty otherwise. Leagues owned by other users are not visible.
   */
  Optional<LeagueSummary> get(long id, String ownerSubject);
}
