package app.zoneblitz.league.hiring;

import java.util.Optional;

/**
 * Read-only use case backing the "Initial Director of Scouting Hiring Summary" page, shown after
 * the user hires their DoS. Parallel to {@link ViewHeadCoachHiringSummary}: the page is accessible
 * while the league is still in the DoS hiring phase (CPU hiring has been fast-forwarded to
 * completion) and lets the user review the league-wide DoS slate before explicitly advancing into
 * the {@link app.zoneblitz.league.phase.LeaguePhase#EXPANSION_DRAFT_SCOUTING} phase.
 */
public interface ViewDirectorOfScoutingHiringSummary {

  /**
   * @return the summary view, or {@link Optional#empty()} when the league does not exist, is not
   *     owned by {@code ownerSubject}, the user has not yet hired their DoS, or the league has
   *     already moved past the DoS hiring phase.
   */
  Optional<DirectorOfScoutingHiringSummaryView> view(long leagueId, String ownerSubject);
}
