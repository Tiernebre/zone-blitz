package app.zoneblitz.league.staff;

import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.hiring.Candidate;
import app.zoneblitz.league.hiring.FindCandidate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class ViewCoachingStaffOrgChartUseCase implements ViewCoachingStaffOrgChart {

  private static final List<StaffRole> OFFENSIVE_POSITION_COACHES =
      List.of(
          StaffRole.QB_COACH,
          StaffRole.RB_COACH,
          StaffRole.WR_COACH,
          StaffRole.TE_COACH,
          StaffRole.OL_COACH);

  private static final List<StaffRole> DEFENSIVE_POSITION_COACHES =
      List.of(StaffRole.DL_COACH, StaffRole.EDGE_COACH, StaffRole.LB_COACH, StaffRole.DB_COACH);

  private final LeagueRepository leagues;
  private final TeamStaffRepository staff;
  private final FindCandidate candidates;

  ViewCoachingStaffOrgChartUseCase(
      LeagueRepository leagues, TeamStaffRepository staff, FindCandidate candidates) {
    this.leagues = leagues;
    this.staff = staff;
    this.candidates = candidates;
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<CoachingStaffOrgChartView> view(long leagueId, String ownerSubject) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");
    var maybeLeague = leagues.findSummaryByIdAndOwner(leagueId, ownerSubject);
    if (maybeLeague.isEmpty()) {
      return Optional.empty();
    }
    var league = maybeLeague.get();
    var byRole = new java.util.EnumMap<StaffRole, Candidate>(StaffRole.class);
    var collegeScouts = new ArrayList<Candidate>();
    var proScouts = new ArrayList<Candidate>();
    for (var member : staff.findAllForTeam(league.userTeamId())) {
      var occupant = candidates.findById(member.candidateId());
      if (occupant.isEmpty()) {
        continue;
      }
      switch (member.role()) {
        case COLLEGE_SCOUT -> collegeScouts.add(occupant.get());
        case PRO_SCOUT -> proScouts.add(occupant.get());
        default -> byRole.put(member.role(), occupant.get());
      }
    }

    var headCoach = seatOf(StaffRole.HEAD_COACH, byRole);
    var directorOfScouting = seatOf(StaffRole.DIRECTOR_OF_SCOUTING, byRole);
    var coordinatorGroups =
        List.of(
            coordinatorGroup(StaffRole.OFFENSIVE_COORDINATOR, OFFENSIVE_POSITION_COACHES, byRole),
            coordinatorGroup(StaffRole.DEFENSIVE_COORDINATOR, DEFENSIVE_POSITION_COACHES, byRole),
            coordinatorGroup(StaffRole.SPECIAL_TEAMS_COORDINATOR, List.of(), byRole));
    return Optional.of(
        new CoachingStaffOrgChartView(
            league,
            headCoach,
            coordinatorGroups,
            directorOfScouting,
            collegeScouts.stream().map(c -> filledSeat(StaffRole.COLLEGE_SCOUT, c)).toList(),
            proScouts.stream().map(c -> filledSeat(StaffRole.PRO_SCOUT, c)).toList()));
  }

  private static CoachingStaffOrgChartView.CoordinatorGroup coordinatorGroup(
      StaffRole coordinator, List<StaffRole> positionCoaches, Map<StaffRole, Candidate> byRole) {
    return new CoachingStaffOrgChartView.CoordinatorGroup(
        seatOf(coordinator, byRole),
        positionCoaches.stream().map(role -> seatOf(role, byRole)).toList());
  }

  private static CoachingStaffOrgChartView.Seat seatOf(
      StaffRole role, Map<StaffRole, Candidate> byRole) {
    return new CoachingStaffOrgChartView.Seat(role, Optional.ofNullable(byRole.get(role)));
  }

  private static CoachingStaffOrgChartView.Seat filledSeat(StaffRole role, Candidate occupant) {
    return new CoachingStaffOrgChartView.Seat(role, Optional.of(occupant));
  }
}
