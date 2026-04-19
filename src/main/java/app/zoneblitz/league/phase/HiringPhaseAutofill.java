package app.zoneblitz.league.phase;

import app.zoneblitz.league.hiring.OfferStatus;
import app.zoneblitz.league.staff.TeamStaffMember;
import app.zoneblitz.league.team.TeamHiringState;

/**
 * Seam invoked when a hiring phase hits its day cap before every team has reached {@link
 * HiringStep#HIRED}. Auto-assigns the best remaining candidate (by scouted overall, deterministic
 * tie-break) to each unresolved team, creates an {@link OfferStatus#ACCEPTED} offer with default
 * terms, marks the candidate hired, transitions the team's {@link TeamHiringState} to {@link
 * HiringStep#HIRED}, and inserts the corresponding {@link TeamStaffMember} row.
 *
 * <p>Never surfaces the candidate's {@code hiddenAttrs} (true rating) — the ranking is driven by
 * {@code scoutedAttrs} only, preserving the hidden-info guarantee from {@code
 * docs/technical/league-phases.md} (Market dynamics & hidden ratings).
 *
 * <p>Idempotent: running twice on a phase where every team is already {@link HiringStep#HIRED} is a
 * no-op.
 */
public interface HiringPhaseAutofill {

  /**
   * Auto-assign hires to any team that is not already {@link HiringStep#HIRED} in the given phase.
   *
   * @param leagueId the league whose hiring phase is being capped off.
   * @param phase the hiring phase to autofill. Phases without a candidate pool (e.g. {@link
   *     LeaguePhase#INITIAL_SETUP}, {@link LeaguePhase#ASSEMBLING_STAFF}) are a no-op.
   * @param phaseDay the {@code phase_day} value the autofill is running at; stored on the resulting
   *     {@link TeamStaffMember#hiredAtDay()} and the synthetic offer row.
   */
  void autofill(long leagueId, LeaguePhase phase, int phaseDay);
}
