package app.zoneblitz.league.staff;

import java.util.Optional;

/**
 * Read-only use case backing the viewer's "Coaching Staff" org-chart page. Returns the user's own
 * franchise staff chart — not the league-wide recap. Usable from any phase once the user's team has
 * at least started being staffed; empty slots show through as unfilled seats so the page is
 * meaningful from the moment the head coach is hired.
 */
public interface ViewCoachingStaffOrgChart {

  /**
   * @return the chart, or {@link Optional#empty()} when the league does not exist or is not owned
   *     by {@code ownerSubject}.
   */
  Optional<CoachingStaffOrgChartView> view(long leagueId, String ownerSubject);
}
