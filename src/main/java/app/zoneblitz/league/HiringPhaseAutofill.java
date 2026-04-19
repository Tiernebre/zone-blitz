package app.zoneblitz.league;

/**
 * Seam invoked when a hiring phase hits its week cap before every franchise has reached {@link
 * HiringStep#HIRED}. Auto-assigns the best remaining candidate (by scouted overall, deterministic
 * tie-break) to each unresolved franchise, creates an {@link OfferStatus#ACCEPTED} offer with
 * default terms, marks the candidate hired, transitions the franchise's {@link
 * FranchiseHiringState} to {@link HiringStep#HIRED}, and inserts the corresponding {@link
 * FranchiseStaffMember} row.
 *
 * <p>Never surfaces the candidate's {@code hiddenAttrs} (true rating) — the ranking is driven by
 * {@code scoutedAttrs} only, preserving the hidden-info guarantee from {@code
 * docs/technical/league-phases.md} (Market dynamics & hidden ratings).
 *
 * <p>Idempotent: running twice on a phase where every franchise is already {@link HiringStep#HIRED}
 * is a no-op.
 */
interface HiringPhaseAutofill {

  /**
   * Auto-assign hires to any franchise that is not already {@link HiringStep#HIRED} in the given
   * phase.
   *
   * @param leagueId the league whose hiring phase is being capped off.
   * @param phase the hiring phase to autofill. Phases without a candidate pool (e.g. {@link
   *     LeaguePhase#INITIAL_SETUP}, {@link LeaguePhase#ASSEMBLING_STAFF}) are a no-op.
   * @param phaseWeek the {@code phase_week} value the autofill is running at; stored on the
   *     resulting {@link FranchiseStaffMember#hiredAtWeek()} and the synthetic offer row.
   */
  void autofill(long leagueId, LeaguePhase phase, int phaseWeek);
}
