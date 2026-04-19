package app.zoneblitz.league.hiring;

import app.zoneblitz.league.phase.LeaguePhase;
import java.math.BigDecimal;
import java.util.Objects;

/**
 * A single completed interview a team conducted against a candidate. {@code interviewIndex} is the
 * 1-based count for that (team, candidate) pair. {@code scoutedOverall} is the noise-reduced
 * scouted estimate produced at the moment of the interview; stored so it is stable across
 * subsequent views.
 */
public record TeamInterview(
    long id,
    long teamId,
    long candidateId,
    LeaguePhase phase,
    int phaseWeek,
    int interviewIndex,
    BigDecimal scoutedOverall) {

  public TeamInterview {
    Objects.requireNonNull(phase, "phase");
    Objects.requireNonNull(scoutedOverall, "scoutedOverall");
  }
}
