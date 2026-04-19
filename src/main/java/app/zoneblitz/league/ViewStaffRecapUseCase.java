package app.zoneblitz.league;

import static app.zoneblitz.jooq.Tables.TEAMS;

import java.util.ArrayList;
import java.util.Objects;
import java.util.Optional;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class ViewStaffRecapUseCase implements ViewStaffRecap {

  private final LeagueRepository leagues;
  private final TeamLookup teams;
  private final FranchiseRepository franchises;
  private final TeamStaffRepository staff;
  private final CandidateRepository candidates;
  private final DSLContext dsl;

  ViewStaffRecapUseCase(
      LeagueRepository leagues,
      TeamLookup teams,
      FranchiseRepository franchises,
      TeamStaffRepository staff,
      CandidateRepository candidates,
      DSLContext dsl) {
    this.leagues = leagues;
    this.teams = teams;
    this.franchises = franchises;
    this.staff = staff;
    this.candidates = candidates;
    this.dsl = dsl;
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<StaffRecapView> view(long leagueId, String ownerSubject) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");
    var maybeLeague = leagues.findSummaryByIdAndOwner(leagueId, ownerSubject);
    if (maybeLeague.isEmpty()) {
      return Optional.empty();
    }
    var league = maybeLeague.get();
    var userTeamId = league.userTeamId();

    var trees = new ArrayList<StaffRecapView.TeamStaffTree>();
    for (var teamId : teams.teamIdsForLeague(leagueId)) {
      var franchiseId =
          dsl.select(TEAMS.FRANCHISE_ID)
              .from(TEAMS)
              .where(TEAMS.ID.eq(teamId))
              .fetchOptional(TEAMS.FRANCHISE_ID);
      if (franchiseId.isEmpty()) {
        continue;
      }
      var franchise = franchises.findById(franchiseId.get());
      if (franchise.isEmpty()) {
        continue;
      }
      var hires = staff.findAllForTeam(teamId);
      var seats = new ArrayList<StaffRecapView.StaffSeat>();
      for (var hire : hires) {
        candidates
            .findById(hire.candidateId())
            .ifPresent(c -> seats.add(new StaffRecapView.StaffSeat(hire, c)));
      }
      trees.add(
          new StaffRecapView.TeamStaffTree(teamId, franchise.get(), teamId == userTeamId, seats));
    }
    trees.sort(
        (a, b) -> {
          if (a.isViewerTeam() && !b.isViewerTeam()) return -1;
          if (!a.isViewerTeam() && b.isViewerTeam()) return 1;
          return a.franchise().name().compareToIgnoreCase(b.franchise().name());
        });
    return Optional.of(new StaffRecapView(league, trees));
  }
}
