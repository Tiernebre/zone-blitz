package app.zoneblitz.league.staff;

import app.zoneblitz.league.LeagueSummary;
import app.zoneblitz.league.franchise.Franchise;
import app.zoneblitz.league.hiring.Candidate;
import app.zoneblitz.league.hiring.ScoutBranch;
import app.zoneblitz.league.phase.LeaguePhase;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

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

  /** Convenience accessor for the viewer franchise's tree so the template can feature it. */
  public Optional<TeamStaffTree> viewerTree() {
    return teams.stream().filter(TeamStaffTree::isViewerTeam).findFirst();
  }

  /** All other franchises in the league, for the league-wide collapsed section. */
  public List<TeamStaffTree> otherTrees() {
    return teams.stream().filter(t -> !t.isViewerTeam()).toList();
  }

  /** Full staff org chart for a team, paired with the candidate row per hired seat. */
  public record TeamStaffTree(
      long teamId, Franchise franchise, boolean isViewerTeam, List<StaffSeat> seats) {

    public TeamStaffTree {
      Objects.requireNonNull(franchise, "franchise");
      Objects.requireNonNull(seats, "seats");
      seats = List.copyOf(seats);
    }

    public Optional<StaffSeat> headCoach() {
      return seatWithRole(StaffRole.HEAD_COACH);
    }

    public Optional<StaffSeat> directorOfScouting() {
      return seatWithRole(StaffRole.DIRECTOR_OF_SCOUTING);
    }

    /** Coordinators (OC, DC, STC) in enum order. */
    public List<StaffSeat> coordinators() {
      return seats.stream()
          .filter(
              s ->
                  s.hire().role() == StaffRole.OFFENSIVE_COORDINATOR
                      || s.hire().role() == StaffRole.DEFENSIVE_COORDINATOR
                      || s.hire().role() == StaffRole.SPECIAL_TEAMS_COORDINATOR)
          .toList();
    }

    /** Position coaches (QB…DB) in enum order. */
    public List<StaffSeat> positionCoaches() {
      return seats.stream().filter(s -> isPositionCoach(s.hire().role())).toList();
    }

    /**
     * Coordinators paired with the position coaches that report to them. OC owns QB/RB/WR/TE/OL, DC
     * owns DL/EDGE/LB/DB, STC has no position coaches reporting up.
     */
    public List<CoordinatorGroup> coordinatorGroups() {
      return coordinators().stream()
          .map(c -> new CoordinatorGroup(c, positionCoachesFor(c.hire().role())))
          .toList();
    }

    private List<StaffSeat> positionCoachesFor(StaffRole coordinator) {
      List<StaffRole> roles =
          switch (coordinator) {
            case OFFENSIVE_COORDINATOR ->
                List.of(
                    StaffRole.QB_COACH,
                    StaffRole.RB_COACH,
                    StaffRole.WR_COACH,
                    StaffRole.TE_COACH,
                    StaffRole.OL_COACH);
            case DEFENSIVE_COORDINATOR ->
                List.of(
                    StaffRole.DL_COACH,
                    StaffRole.EDGE_COACH,
                    StaffRole.LB_COACH,
                    StaffRole.DB_COACH);
            default -> List.of();
          };
      return seats.stream().filter(s -> roles.contains(s.hire().role())).toList();
    }

    public List<StaffSeat> collegeScouts() {
      return scouts(ScoutBranch.COLLEGE);
    }

    public List<StaffSeat> proScouts() {
      return scouts(ScoutBranch.PRO);
    }

    private List<StaffSeat> scouts(ScoutBranch branch) {
      return seats.stream()
          .filter(
              s ->
                  (s.hire().role() == StaffRole.COLLEGE_SCOUT
                          || s.hire().role() == StaffRole.PRO_SCOUT)
                      && s.hire().scoutBranch().isPresent()
                      && s.hire().scoutBranch().get() == branch)
          .toList();
    }

    private Optional<StaffSeat> seatWithRole(StaffRole role) {
      return seats.stream().filter(s -> s.hire().role() == role).findFirst();
    }

    private static boolean isPositionCoach(StaffRole role) {
      return switch (role) {
        case QB_COACH,
            RB_COACH,
            WR_COACH,
            TE_COACH,
            OL_COACH,
            DL_COACH,
            EDGE_COACH,
            LB_COACH,
            DB_COACH ->
            true;
        default -> false;
      };
    }
  }

  /** A coordinator seat with the position coaches that report to it. */
  public record CoordinatorGroup(StaffSeat coordinator, List<StaffSeat> positionCoaches) {

    public CoordinatorGroup {
      Objects.requireNonNull(coordinator, "coordinator");
      positionCoaches = List.copyOf(positionCoaches);
    }
  }

  /** A single filled seat — role, candidate snapshot, scout branch (when applicable). */
  public record StaffSeat(TeamStaffMember hire, Candidate candidate) {

    public StaffSeat {
      Objects.requireNonNull(hire, "hire");
      Objects.requireNonNull(candidate, "candidate");
    }

    public String fullName() {
      return candidate.firstName() + " " + candidate.lastName();
    }
  }
}
