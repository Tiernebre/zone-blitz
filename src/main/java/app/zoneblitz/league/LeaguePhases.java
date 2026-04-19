package app.zoneblitz.league;

import java.util.Map;
import java.util.Optional;

/**
 * Phase ordering and next-phase lookup. Centralizes the linear sequence so {@link
 * AdvancePhaseUseCase} and tests agree on "what comes next".
 */
final class LeaguePhases {

  private static final Map<LeaguePhase, LeaguePhase> NEXT =
      Map.of(LeaguePhase.INITIAL_SETUP, LeaguePhase.HIRING_HEAD_COACH);

  private LeaguePhases() {}

  static Optional<LeaguePhase> next(LeaguePhase phase) {
    return Optional.ofNullable(NEXT.get(phase));
  }
}
