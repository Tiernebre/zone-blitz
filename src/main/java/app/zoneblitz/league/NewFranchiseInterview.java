package app.zoneblitz.league;

import java.math.BigDecimal;
import java.util.Objects;

/** Insert payload for {@link FranchiseInterviewRepository#insert}. */
record NewFranchiseInterview(
    long leagueId,
    long franchiseId,
    long candidateId,
    LeaguePhase phase,
    int phaseWeek,
    int interviewIndex,
    BigDecimal scoutedOverall) {

  NewFranchiseInterview {
    Objects.requireNonNull(phase, "phase");
    Objects.requireNonNull(scoutedOverall, "scoutedOverall");
  }
}
