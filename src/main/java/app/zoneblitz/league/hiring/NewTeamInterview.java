package app.zoneblitz.league.hiring;

import app.zoneblitz.league.phase.LeaguePhase;
import java.math.BigDecimal;
import java.util.Objects;

/** Insert payload for {@link TeamInterviewRepository#insert}. */
public record NewTeamInterview(
    long teamId,
    long candidateId,
    LeaguePhase phase,
    int phaseWeek,
    int interviewIndex,
    BigDecimal scoutedOverall) {

  public NewTeamInterview {
    Objects.requireNonNull(phase, "phase");
    Objects.requireNonNull(scoutedOverall, "scoutedOverall");
  }
}
