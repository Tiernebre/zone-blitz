package app.zoneblitz.league;

import java.util.List;

/** Feature-internal persistence seam for {@link FranchiseInterview}. */
interface FranchiseInterviewRepository {

  /** Insert a completed interview row. Returns the persisted record with its generated id. */
  FranchiseInterview insert(NewFranchiseInterview interview);

  /**
   * Count interviews this franchise has completed against a given candidate in the given phase.
   * Used to drive the noise-reduction function's exponent.
   */
  int countForCandidate(long leagueId, long franchiseId, long candidateId, LeaguePhase phase);

  /**
   * Count interviews this franchise has completed this week of the given phase. Used to enforce the
   * weekly capacity cap.
   */
  int countForWeek(long leagueId, long franchiseId, LeaguePhase phase, int phaseWeek);

  /** All interviews this franchise has completed in the given phase, ordered by id ascending. */
  List<FranchiseInterview> findAllFor(long leagueId, long franchiseId, LeaguePhase phase);
}
