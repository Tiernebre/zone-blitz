package app.zoneblitz.league.staff;

import app.zoneblitz.league.LeagueSummary;
import app.zoneblitz.league.hiring.Candidate;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * View-model for the viewer-team org chart. Each seat is a {@link StaffRole} paired with an
 * optional {@link Candidate} — absent when that seat is not yet filled. Seats are grouped by branch
 * so the template can render the coaching tree and the scouting tree side-by-side without any
 * client-side logic.
 */
public record CoachingStaffOrgChartView(
    LeagueSummary league,
    Seat headCoach,
    List<CoordinatorGroup> coordinatorGroups,
    Seat directorOfScouting,
    List<Seat> collegeScouts,
    List<Seat> proScouts) {

  public CoachingStaffOrgChartView {
    Objects.requireNonNull(league, "league");
    Objects.requireNonNull(headCoach, "headCoach");
    Objects.requireNonNull(directorOfScouting, "directorOfScouting");
    coordinatorGroups = List.copyOf(coordinatorGroups);
    collegeScouts = List.copyOf(collegeScouts);
    proScouts = List.copyOf(proScouts);
  }

  /** A coordinator seat with the position coaches that report to it. */
  public record CoordinatorGroup(Seat coordinator, List<Seat> positionCoaches) {

    public CoordinatorGroup {
      Objects.requireNonNull(coordinator, "coordinator");
      positionCoaches = List.copyOf(positionCoaches);
    }
  }

  /** A single seat on the chart; {@code occupant} is absent when the seat is unfilled. */
  public record Seat(StaffRole role, Optional<Candidate> occupant) {

    public Seat {
      Objects.requireNonNull(role, "role");
      Objects.requireNonNull(occupant, "occupant");
    }

    public boolean filled() {
      return occupant.isPresent();
    }
  }
}
