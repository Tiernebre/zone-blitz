package app.zoneblitz.league;

import java.util.ArrayList;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class ViewStaffRecapUseCase implements ViewStaffRecap {

  private final LeagueRepository leagues;
  private final TeamLookup teams;
  private final FranchiseRepository franchises;
  private final FranchiseStaffRepository staff;
  private final CandidateRepository candidates;

  ViewStaffRecapUseCase(
      LeagueRepository leagues,
      TeamLookup teams,
      FranchiseRepository franchises,
      FranchiseStaffRepository staff,
      CandidateRepository candidates) {
    this.leagues = leagues;
    this.teams = teams;
    this.franchises = franchises;
    this.staff = staff;
    this.candidates = candidates;
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
    var userFranchiseId = league.userFranchise().id();

    var trees = new ArrayList<StaffRecapView.FranchiseStaffTree>();
    for (var franchiseId : teams.franchiseIdsForLeague(leagueId)) {
      var franchise = franchises.findById(franchiseId);
      if (franchise.isEmpty()) {
        continue;
      }
      var hires = staff.findAllForFranchise(leagueId, franchiseId);
      var seats = new ArrayList<StaffRecapView.StaffSeat>();
      for (var hire : hires) {
        candidates
            .findById(hire.candidateId())
            .ifPresent(c -> seats.add(new StaffRecapView.StaffSeat(hire, c)));
      }
      trees.add(
          new StaffRecapView.FranchiseStaffTree(
              franchise.get(), franchiseId == userFranchiseId, seats));
    }
    trees.sort(
        (a, b) -> {
          if (a.isViewerFranchise() && !b.isViewerFranchise()) return -1;
          if (!a.isViewerFranchise() && b.isViewerFranchise()) return 1;
          return a.franchise().name().compareToIgnoreCase(b.franchise().name());
        });
    return Optional.of(new StaffRecapView(league, trees));
  }
}
