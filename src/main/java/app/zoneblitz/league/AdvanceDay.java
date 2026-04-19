package app.zoneblitz.league;

import app.zoneblitz.league.phase.AdvancePhase;

/**
 * Use case: run a single-day tick on a league.
 *
 * <p>Runs CPU team strategies for the current phase, re-evaluates every active offer's stance, then
 * increments {@code phase_day}. If the phase hits its day cap or every team has resolved (e.g.
 * hired), {@link AdvancePhase} is invoked and the response reports the new phase.
 */
public interface AdvanceDay {

  /**
   * @return {@link AdvanceDayResult.Ticked} on a successful day tick (phase may or may not have
   *     rolled over); {@link AdvanceDayResult.NotFound} if the league does not exist or is not
   *     owned by {@code ownerSubject}.
   */
  AdvanceDayResult advance(long leagueId, String ownerSubject);
}
