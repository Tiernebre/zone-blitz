package app.zoneblitz.league;

import java.util.List;

/**
 * Read-side companion to {@link TeamRepository} for features that need to know which franchises
 * belong to a league. Kept separate so the write-side repository stays insert-only.
 */
interface TeamLookup {

  /** Return the franchise ids participating in the given league, ordered by franchise id. */
  List<Long> franchiseIdsForLeague(long leagueId);
}
