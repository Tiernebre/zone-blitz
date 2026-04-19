package app.zoneblitz.league.hiring;

import app.zoneblitz.league.phase.LeaguePhase;
import java.util.Objects;

/** Insert payload for {@link TeamInterviewRepository#insert}. */
public record NewTeamInterview(
    long teamId,
    long candidateId,
    LeaguePhase phase,
    int phaseDay,
    int interviewIndex,
    InterviewInterest interestLevel) {

  public NewTeamInterview {
    Objects.requireNonNull(phase, "phase");
    Objects.requireNonNull(interestLevel, "interestLevel");
  }
}
