package app.zoneblitz.league.hiring.view;

import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.candidates.CandidatePoolRepository;
import app.zoneblitz.league.hiring.hire.LeagueHires;
import app.zoneblitz.league.phase.LeaguePhase;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class ViewHeadCoachHiringSummaryUseCase implements ViewHeadCoachHiringSummary {

  private final LeagueRepository leagues;
  private final CandidatePoolRepository pools;
  private final LeagueHires leagueHires;

  ViewHeadCoachHiringSummaryUseCase(
      LeagueRepository leagues, CandidatePoolRepository pools, LeagueHires leagueHires) {
    this.leagues = leagues;
    this.pools = pools;
    this.leagueHires = leagueHires;
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<HeadCoachHiringSummaryView> view(long leagueId, String ownerSubject) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");
    var maybeLeague = leagues.findSummaryByIdAndOwner(leagueId, ownerSubject);
    if (maybeLeague.isEmpty()) {
      return Optional.empty();
    }
    var league = maybeLeague.get();
    if (league.phase() != LeaguePhase.HIRING_HEAD_COACH) {
      return Optional.empty();
    }
    var pool =
        pools.findByLeaguePhaseAndType(
            leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    if (pool.isEmpty()) {
      return Optional.empty();
    }
    var hires = leagueHires.forLeaguePool(leagueId, league.userTeamId(), pool.get().id());
    var userHired =
        hires.stream().anyMatch(h -> h.teamId() == league.userTeamId() && h.hire().isPresent());
    if (!userHired) {
      return Optional.empty();
    }
    return Optional.of(new HeadCoachHiringSummaryView(league, hires));
  }
}
