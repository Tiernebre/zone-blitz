package app.zoneblitz.league.hiring;

/** Sealed outcomes for {@link StartInterview#start}. */
public sealed interface InterviewResult {

  /** Interview recorded. Callers re-fetch the appropriate phase view for rendering. */
  record Started(long candidateId) implements InterviewResult {}

  /** League not found for the requesting user, or not in a hiring phase. */
  record NotFound(long leagueId) implements InterviewResult {}

  /** Candidate does not exist in this league's current hiring pool. */
  record UnknownCandidate(long candidateId) implements InterviewResult {}

  /** Team has already hit its per-day interview cap. */
  record CapacityReached(int capacity) implements InterviewResult {}

  /** Team has already interviewed this candidate — interviews are one-shot. */
  record AlreadyInterviewed(long candidateId) implements InterviewResult {}
}
