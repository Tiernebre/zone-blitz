package app.zoneblitz.league.hiring;

/**
 * Feature-public use case for adding or removing a candidate on the requesting franchise's
 * HIRING_HEAD_COACH shortlist. Both operations are idempotent — adding an already-shortlisted
 * candidate is a no-op that still returns {@link ShortlistResult.Updated}; same for removing one
 * that isn't on the list.
 */
public interface ManageHeadCoachShortlist {

  ShortlistResult add(long leagueId, long candidateId, String ownerSubject);

  ShortlistResult remove(long leagueId, long candidateId, String ownerSubject);
}
