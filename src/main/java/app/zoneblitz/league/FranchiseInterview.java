package app.zoneblitz.league;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * A single completed interview a franchise conducted against a candidate. {@code interviewIndex} is
 * the 1-based count for that (franchise, candidate) pair. {@code scoutedOverall} is the
 * noise-reduced scouted estimate produced at the moment of the interview; stored so it is stable
 * across subsequent views.
 */
public record FranchiseInterview(
    long id,
    long leagueId,
    long franchiseId,
    long candidateId,
    LeaguePhase phase,
    int phaseWeek,
    int interviewIndex,
    BigDecimal scoutedOverall) {

  public FranchiseInterview {
    Objects.requireNonNull(phase, "phase");
    Objects.requireNonNull(scoutedOverall, "scoutedOverall");
  }
}
