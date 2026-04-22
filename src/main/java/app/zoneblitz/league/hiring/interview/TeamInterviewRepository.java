package app.zoneblitz.league.hiring.interview;

import app.zoneblitz.league.phase.LeaguePhase;
import java.util.List;
import java.util.Optional;

/** Feature-internal persistence seam for {@link TeamInterview}. */
public interface TeamInterviewRepository {

  /** Insert a completed interview row. Returns the persisted record with its generated id. */
  TeamInterview insert(NewTeamInterview interview);

  /**
   * Count interviews this team has completed against a given candidate in the given phase. Used to
   * enforce the one-interview-per-candidate rule.
   */
  int countForCandidate(long teamId, long candidateId, LeaguePhase phase);

  /**
   * Count interviews this team has completed this day of the given phase. Used to enforce the daily
   * capacity cap.
   */
  int countForDay(long teamId, LeaguePhase phase, int phaseDay);

  /** The single interview this team has with the given candidate in the given phase, if any. */
  Optional<TeamInterview> find(long teamId, long candidateId, LeaguePhase phase);

  /** All interviews this team has completed in the given phase, ordered by id ascending. */
  List<TeamInterview> findAllFor(long teamId, LeaguePhase phase);
}
