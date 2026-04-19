package app.zoneblitz.league;

import java.util.List;

/** Feature-internal persistence seam for {@link TeamInterview}. */
interface TeamInterviewRepository {

  /** Insert a completed interview row. Returns the persisted record with its generated id. */
  TeamInterview insert(NewTeamInterview interview);

  /**
   * Count interviews this team has completed against a given candidate in the given phase. Used to
   * drive the noise-reduction function's exponent.
   */
  int countForCandidate(long teamId, long candidateId, LeaguePhase phase);

  /**
   * Count interviews this team has completed this week of the given phase. Used to enforce the
   * weekly capacity cap.
   */
  int countForWeek(long teamId, LeaguePhase phase, int phaseWeek);

  /** All interviews this team has completed in the given phase, ordered by id ascending. */
  List<TeamInterview> findAllFor(long teamId, LeaguePhase phase);
}
