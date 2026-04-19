package app.zoneblitz.league.phase;

import app.zoneblitz.league.AdvanceDayUseCase;
import java.util.Map;
import java.util.Optional;

/**
 * Phase ordering, next-phase lookup, and per-phase day caps. Centralizes the linear sequence so
 * {@link AdvancePhaseUseCase}, {@link AdvanceDayUseCase}, and tests agree on "what comes next" and
 * "when does the phase end by cap".
 *
 * <p>Per {@code docs/technical/league-phases.md} (Hiring sub-state machine):
 *
 * <ul>
 *   <li>{@link LeaguePhase#HIRING_HEAD_COACH} — max 21 days.
 *   <li>{@link LeaguePhase#HIRING_DIRECTOR_OF_SCOUTING} — max 21 days.
 *   <li>{@link LeaguePhase#ASSEMBLING_STAFF} — max 7 days.
 *   <li>{@link LeaguePhase#INITIAL_SETUP} — no cap; user-advanced explicitly.
 * </ul>
 */
public final class LeaguePhases {

  private static final Map<LeaguePhase, LeaguePhase> NEXT =
      Map.of(
          LeaguePhase.INITIAL_SETUP, LeaguePhase.HIRING_HEAD_COACH,
          LeaguePhase.HIRING_HEAD_COACH, LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING,
          LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING, LeaguePhase.ASSEMBLING_STAFF,
          LeaguePhase.ASSEMBLING_STAFF, LeaguePhase.COMPLETE);

  private static final Map<LeaguePhase, Integer> MAX_DAYS =
      Map.of(
          LeaguePhase.HIRING_HEAD_COACH, 21,
          LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING, 21,
          LeaguePhase.ASSEMBLING_STAFF, 7);

  private LeaguePhases() {}

  public static Optional<LeaguePhase> next(LeaguePhase phase) {
    return Optional.ofNullable(NEXT.get(phase));
  }

  /**
   * Returns the phase's day cap, or {@link Optional#empty()} if the phase has no cap (e.g. {@link
   * LeaguePhase#INITIAL_SETUP}, which is user-advanced).
   */
  public static Optional<Integer> maxDays(LeaguePhase phase) {
    return Optional.ofNullable(MAX_DAYS.get(phase));
  }
}
