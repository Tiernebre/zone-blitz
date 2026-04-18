package app.zoneblitz.league;

/** Deletes a league the given user owns. */
public interface DeleteLeague {

  /**
   * @return {@link DeleteLeagueResult.Deleted} when the league existed and was owned by {@code
   *     ownerSubject}; {@link DeleteLeagueResult.NotFound} otherwise. Leagues owned by other users
   *     are not visible to {@code ownerSubject} and therefore surface as {@link
   *     DeleteLeagueResult.NotFound}.
   */
  DeleteLeagueResult delete(long id, String ownerSubject);
}
