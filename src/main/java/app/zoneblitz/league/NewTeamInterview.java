package app.zoneblitz.league;

import java.math.BigDecimal;
import java.util.Objects;

/** Insert payload for {@link TeamInterviewRepository#insert}. */
record NewTeamInterview(
    long teamId,
    long candidateId,
    LeaguePhase phase,
    int phaseWeek,
    int interviewIndex,
    BigDecimal scoutedOverall) {

  NewTeamInterview {
    Objects.requireNonNull(phase, "phase");
    Objects.requireNonNull(scoutedOverall, "scoutedOverall");
  }
}
