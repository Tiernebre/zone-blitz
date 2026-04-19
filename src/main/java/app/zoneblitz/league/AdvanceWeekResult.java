package app.zoneblitz.league;

import app.zoneblitz.league.phase.LeaguePhase;
import java.util.Optional;

public sealed interface AdvanceWeekResult {

  /**
   * @param leagueId the league that ticked.
   * @param phase the league's phase after the tick — may differ from the entry phase if the tick
   *     completed the previous phase.
   * @param phaseWeek the {@code phase_week} value after the tick.
   * @param transitionedTo present when the tick completed the previous phase and transitioned.
   */
  record Ticked(
      long leagueId, LeaguePhase phase, int phaseWeek, Optional<LeaguePhase> transitionedTo)
      implements AdvanceWeekResult {}

  record NotFound(long leagueId) implements AdvanceWeekResult {}
}
