package app.zoneblitz.league.hiring;

/** Sealed outcomes for {@link StartInterview#start}. */
public sealed interface InterviewResult {

  /** Interview recorded; the refreshed view-model is returned for fragment rendering. */
  record Started(HeadCoachHiringView view) implements InterviewResult {}

  /** League not found for the requesting user, or not in the HC hiring phase. */
  record NotFound(long leagueId) implements InterviewResult {}

  /** Candidate does not exist in this league's HC pool. */
  record UnknownCandidate(long candidateId) implements InterviewResult {}

  /** Franchise has already hit its per-week interview cap. */
  record CapacityReached(int capacity) implements InterviewResult {}
}
