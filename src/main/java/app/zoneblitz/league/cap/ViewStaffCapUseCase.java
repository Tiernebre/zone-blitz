package app.zoneblitz.league.cap;

import app.zoneblitz.league.LeagueRepository;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class ViewStaffCapUseCase implements ViewStaffCap {

  private final LeagueRepository leagues;
  private final StaffCapBreakdownRepository breakdowns;

  ViewStaffCapUseCase(LeagueRepository leagues, StaffCapBreakdownRepository breakdowns) {
    this.leagues = leagues;
    this.breakdowns = breakdowns;
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<StaffCapView> view(long leagueId, String ownerSubject) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");
    return leagues
        .findSummaryByIdAndOwner(leagueId, ownerSubject)
        .map(
            league -> {
              var breakdown = breakdowns.breakdown(league.userTeamId(), league.season());
              return new StaffCapView(
                  league,
                  breakdown.budgetCents(),
                  breakdown.contracts(),
                  breakdown.offers(),
                  breakdown.deadCap());
            });
  }
}
