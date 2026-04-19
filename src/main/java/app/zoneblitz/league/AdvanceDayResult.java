package app.zoneblitz.league;

import app.zoneblitz.league.phase.LeaguePhase;
import java.util.Optional;

public sealed interface AdvanceDayResult {

  /**
   * @param leagueId the league that ticked.
   * @param phase the league's phase after the tick — may differ from the entry phase if the tick
   *     completed the previous phase.
   * @param phaseDay the {@code phase_day} value after the tick.
   * @param transitionedTo present when the tick completed the previous phase and transitioned.
   */
  record Ticked(
      long leagueId, LeaguePhase phase, int phaseDay, Optional<LeaguePhase> transitionedTo)
      implements AdvanceDayResult {}

  record NotFound(long leagueId) implements AdvanceDayResult {}
}
