package app.zoneblitz.league;

import java.util.List;
import java.util.Objects;

/**
 * View model for the {@link LeaguePhase#ASSEMBLING_STAFF} recap page. {@code teams} is ordered with
 * the viewer's team first (flagged via {@link TeamStaffTree#isViewerTeam()}), so the template can
 * render it expanded and the rest collapsed without extra logic.
 */
public record StaffRecapView(LeagueSummary league, List<TeamStaffTree> teams) {

  public StaffRecapView {
    Objects.requireNonNull(league, "league");
    Objects.requireNonNull(teams, "teams");
    teams = List.copyOf(teams);
  }

  /** Full staff org chart for a team, paired with the candidate row per hired seat. */
  public record TeamStaffTree(
      long teamId, Franchise franchise, boolean isViewerTeam, List<StaffSeat> seats) {

    public TeamStaffTree {
      Objects.requireNonNull(franchise, "franchise");
      Objects.requireNonNull(seats, "seats");
      seats = List.copyOf(seats);
    }
  }

  /** A single filled seat — role, candidate snapshot, scout branch (when applicable). */
  public record StaffSeat(TeamStaffMember hire, Candidate candidate) {

    public StaffSeat {
      Objects.requireNonNull(hire, "hire");
      Objects.requireNonNull(candidate, "candidate");
    }
  }
}
