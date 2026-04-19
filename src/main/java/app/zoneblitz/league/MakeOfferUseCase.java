package app.zoneblitz.league;

import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class MakeOfferUseCase implements MakeOffer {

  private static final Logger log = LoggerFactory.getLogger(MakeOfferUseCase.class);

  private final LeagueRepository leagues;
  private final CandidatePoolRepository pools;
  private final CandidateRepository candidates;
  private final CandidateOfferRepository offers;
  private final FranchiseHiringStateRepository hiringStates;

  MakeOfferUseCase(
      LeagueRepository leagues,
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidateOfferRepository offers,
      FranchiseHiringStateRepository hiringStates) {
    this.leagues = leagues;
    this.pools = pools;
    this.candidates = candidates;
    this.offers = offers;
    this.hiringStates = hiringStates;
  }

  @Override
  @Transactional
  public MakeOfferResult offer(
      long leagueId, long candidateId, String ownerSubject, OfferTerms terms) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");
    Objects.requireNonNull(terms, "terms");

    var maybeLeague = leagues.findSummaryByIdAndOwner(leagueId, ownerSubject);
    if (maybeLeague.isEmpty()) {
      return new MakeOfferResult.NotFound(leagueId);
    }
    var league = maybeLeague.get();
    if (league.phase() != LeaguePhase.HIRING_HEAD_COACH) {
      return new MakeOfferResult.NotFound(leagueId);
    }
    var maybePool =
        pools.findByLeaguePhaseAndType(
            leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    if (maybePool.isEmpty()) {
      return new MakeOfferResult.UnknownCandidate(candidateId);
    }
    var candidate = candidates.findById(candidateId);
    if (candidate.isEmpty() || candidate.get().poolId() != maybePool.get().id()) {
      return new MakeOfferResult.UnknownCandidate(candidateId);
    }
    if (candidate.get().hiredByFranchiseId().isPresent()) {
      return new MakeOfferResult.UnknownCandidate(candidateId);
    }

    var franchiseId = league.userFranchise().id();
    var hiringState = hiringStates.find(leagueId, franchiseId, LeaguePhase.HIRING_HEAD_COACH);
    if (hiringState.isPresent() && hiringState.get().step() == HiringStep.HIRED) {
      return new MakeOfferResult.AlreadyHired(franchiseId);
    }

    var existing = offers.findActiveForFranchise(franchiseId);
    if (existing.stream().anyMatch(o -> o.candidateId() == candidateId)) {
      return new MakeOfferResult.ActiveOfferExists(candidateId, franchiseId);
    }

    var phaseWeek = league.phaseWeek();
    var saved =
        offers.insertActive(candidateId, franchiseId, OfferTermsJson.toJson(terms), phaseWeek);
    log.info(
        "offer submitted leagueId={} franchiseId={} candidateId={} offerId={} week={}",
        leagueId,
        franchiseId,
        candidateId,
        saved.id(),
        phaseWeek);
    return new MakeOfferResult.Created(saved);
  }
}
