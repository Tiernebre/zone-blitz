package app.zoneblitz.league;

/**
 * Use case: run a week tick on a league.
 *
 * <p>Runs CPU franchise strategies (none wired yet — the seam is in place for future phases),
 * increments {@code phase_week}, then runs the phase-completion check. If the phase completes as a
 * result of the tick, {@link AdvancePhase} is invoked and the response reports the new phase.
 *
 * <p>For the foundational scope (issue #601) no phase defines a completion rule, so advances only
 * ever happen through {@link AdvancePhase}. {@link AdvanceWeek} exists with the correct shape so
 * later phases can plug in without reshaping callers.
 */
public interface AdvanceWeek {

  /**
   * @return {@link AdvanceWeekResult.Ticked} on a successful week tick (phase may or may not have
   *     rolled over); {@link AdvanceWeekResult.NotFound} if the league does not exist or is not
   *     owned by {@code ownerSubject}.
   */
  AdvanceWeekResult advance(long leagueId, String ownerSubject);
}
