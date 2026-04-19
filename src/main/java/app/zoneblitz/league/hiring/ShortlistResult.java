package app.zoneblitz.league;

/** Sealed outcomes for adding/removing a candidate on the user's hiring shortlist. */
public sealed interface ShortlistResult {

  /** Shortlist updated; the refreshed view-model is returned for fragment rendering. */
  record Updated(HeadCoachHiringView view) implements ShortlistResult {}

  /** League not found for the requesting user, or not in the HC hiring phase. */
  record NotFound(long leagueId) implements ShortlistResult {}

  /** Candidate does not exist in this league's HC pool. */
  record UnknownCandidate(long candidateId) implements ShortlistResult {}
}
