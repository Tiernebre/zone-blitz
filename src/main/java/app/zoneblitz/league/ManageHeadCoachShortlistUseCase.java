package app.zoneblitz.league;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class ManageHeadCoachShortlistUseCase implements ManageHeadCoachShortlist {

  private final LeagueRepository leagues;
  private final CandidatePoolRepository pools;
  private final CandidateRepository candidates;
  private final CandidatePreferencesRepository preferences;
  private final FranchiseHiringStateRepository hiringStates;
  private final FranchiseInterviewRepository interviews;

  ManageHeadCoachShortlistUseCase(
      LeagueRepository leagues,
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      FranchiseHiringStateRepository hiringStates,
      FranchiseInterviewRepository interviews) {
    this.leagues = leagues;
    this.pools = pools;
    this.candidates = candidates;
    this.preferences = preferences;
    this.hiringStates = hiringStates;
    this.interviews = interviews;
  }

  @Override
  @Transactional
  public ShortlistResult add(long leagueId, long candidateId, String ownerSubject) {
    return mutate(leagueId, candidateId, ownerSubject, ids -> addUnique(ids, candidateId));
  }

  @Override
  @Transactional
  public ShortlistResult remove(long leagueId, long candidateId, String ownerSubject) {
    return mutate(
        leagueId,
        candidateId,
        ownerSubject,
        ids -> ids.stream().filter(id -> id != candidateId).toList());
  }

  private ShortlistResult mutate(
      long leagueId,
      long candidateId,
      String ownerSubject,
      java.util.function.UnaryOperator<List<Long>> transform) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");
    var maybeLeague = leagues.findSummaryByIdAndOwner(leagueId, ownerSubject);
    if (maybeLeague.isEmpty()) {
      return new ShortlistResult.NotFound(leagueId);
    }
    var league = maybeLeague.get();
    var phase = league.phase();
    var poolType = HiringPhases.poolTypeFor(phase);
    if (poolType.isEmpty()) {
      return new ShortlistResult.NotFound(leagueId);
    }
    var maybePool = pools.findByLeaguePhaseAndType(leagueId, phase, poolType.get());
    if (maybePool.isEmpty()) {
      return new ShortlistResult.NotFound(leagueId);
    }
    var candidate = candidates.findById(candidateId);
    if (candidate.isEmpty() || candidate.get().poolId() != maybePool.get().id()) {
      return new ShortlistResult.UnknownCandidate(candidateId);
    }
    var franchiseId = league.userFranchise().id();
    var existing = hiringStates.find(leagueId, franchiseId, phase);
    var currentIds = existing.map(FranchiseHiringState::shortlist).orElse(List.of());
    var interviewingIds =
        existing.map(FranchiseHiringState::interviewingCandidateIds).orElse(List.of());
    var updatedIds = transform.apply(currentIds);
    hiringStates.upsert(
        new FranchiseHiringState(
            existing.map(FranchiseHiringState::id).orElse(0L),
            leagueId,
            franchiseId,
            phase,
            HiringStep.SEARCHING,
            updatedIds,
            interviewingIds));
    var pool = candidates.findAllByPoolId(maybePool.get().id());
    var prefs =
        pool.stream()
            .map(c -> preferences.findByCandidateId(c.id()))
            .flatMap(java.util.Optional::stream)
            .toList();
    var interviewHistory = interviews.findAllFor(leagueId, franchiseId, phase);
    var view =
        HeadCoachHiringViewModel.assemble(
            league,
            pool,
            prefs,
            updatedIds,
            interviewHistory,
            StartInterview.DEFAULT_WEEKLY_CAPACITY);
    return new ShortlistResult.Updated(view);
  }

  private static List<Long> addUnique(List<Long> ids, long candidateId) {
    if (ids.contains(candidateId)) {
      return ids;
    }
    var updated = new ArrayList<Long>(ids.size() + 1);
    updated.addAll(ids);
    updated.add(candidateId);
    return List.copyOf(updated);
  }
}
