package app.zoneblitz.league;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class ViewHeadCoachHiringUseCase implements ViewHeadCoachHiring {

  private final LeagueRepository leagues;
  private final CandidatePoolRepository pools;
  private final CandidateRepository candidates;
  private final CandidatePreferencesRepository preferences;
  private final FranchiseHiringStateRepository hiringStates;

  ViewHeadCoachHiringUseCase(
      LeagueRepository leagues,
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      FranchiseHiringStateRepository hiringStates) {
    this.leagues = leagues;
    this.pools = pools;
    this.candidates = candidates;
    this.preferences = preferences;
    this.hiringStates = hiringStates;
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<HeadCoachHiringView> view(long leagueId, String ownerSubject) {
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
      return Optional.of(new HeadCoachHiringView(league, List.of(), List.of()));
    }
    var rows = candidates.findAllByPoolId(pool.get().id());
    var prefs =
        rows.stream()
            .map(c -> preferences.findByCandidateId(c.id()))
            .flatMap(Optional::stream)
            .toList();
    var shortlist =
        hiringStates
            .find(leagueId, league.userFranchise().id(), LeaguePhase.HIRING_HEAD_COACH)
            .map(FranchiseHiringState::shortlist)
            .orElse(List.of());
    return Optional.of(HeadCoachHiringViewModel.assemble(league, rows, prefs, shortlist));
  }
}
