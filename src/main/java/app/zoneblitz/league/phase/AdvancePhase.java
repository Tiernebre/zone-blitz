package app.zoneblitz.league.phase;

/**
 * Use case: advance a league from its current phase to the next phase.
 *
 * <p>Runs the outgoing phase's {@link PhaseTransitionHandler#onExit} hook, persists the new phase
 * with {@code phase_day} reset to 1, then runs the incoming phase's {@link
 * PhaseTransitionHandler#onEntry} hook. All within a single transaction.
 */
public interface AdvancePhase {

  /**
   * @param leagueId the league to advance.
   * @param ownerSubject OAuth2 subject of the caller; a league not owned by this subject surfaces
   *     as {@link AdvancePhaseResult.NotFound}.
   * @return {@link AdvancePhaseResult.Advanced} on a successful transition; {@link
   *     AdvancePhaseResult.NotFound} if the league does not exist or is not owned by {@code
   *     ownerSubject}; {@link AdvancePhaseResult.NoNextPhase} if the league is already in the
   *     terminal phase.
   */
  AdvancePhaseResult advance(long leagueId, String ownerSubject);
}
