package app.zoneblitz.league.hiring;

import app.zoneblitz.league.hiring.view.HeadCoachHiringSummaryView;
import java.util.Optional;

/**
 * Read-only use case backing the "Initial Head Coach Hiring Summary" page shown after the user
 * hires their HC. The page is accessible while the league is still in the head-coach hiring phase
 * (all CPU hiring has been fast-forwarded to completion) and lets the user review the league-wide
 * HC slate before explicitly advancing to the Director of Scouting hiring phase.
 */
public interface ViewHeadCoachHiringSummary {

  /**
   * @return the summary view, or {@link Optional#empty()} when the league does not exist, is not
   *     owned by {@code ownerSubject}, the user has not yet hired their head coach, or the league
   *     has already moved past the head-coach hiring phase.
   */
  Optional<HeadCoachHiringSummaryView> view(long leagueId, String ownerSubject);
}
