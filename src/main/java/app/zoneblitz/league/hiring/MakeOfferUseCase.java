package app.zoneblitz.league.hiring;

import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.phase.HiringPhases;
import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.team.TeamHiringStateRepository;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MakeOfferUseCase implements MakeOffer {

  private static final Logger log = LoggerFactory.getLogger(MakeOfferUseCase.class);

  private final LeagueRepository leagues;
  private final CandidatePoolRepository pools;
  private final CandidateRepository candidates;
  private final CandidateOfferRepository offers;
  private final TeamHiringStateRepository hiringStates;

  public MakeOfferUseCase(
      LeagueRepository leagues,
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidateOfferRepository offers,
      TeamHiringStateRepository hiringStates) {
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
    var phase = league.phase();
    var poolType = HiringPhases.poolTypeFor(phase);
    if (poolType.isEmpty()) {
      return new MakeOfferResult.NotFound(leagueId);
    }
    var maybePool = pools.findByLeaguePhaseAndType(leagueId, phase, poolType.get());
    if (maybePool.isEmpty()) {
      return new MakeOfferResult.UnknownCandidate(candidateId);
    }
    var candidate = candidates.findById(candidateId);
    if (candidate.isEmpty() || candidate.get().poolId() != maybePool.get().id()) {
      return new MakeOfferResult.UnknownCandidate(candidateId);
    }
    if (candidate.get().hiredByTeamId().isPresent()) {
      return new MakeOfferResult.UnknownCandidate(candidateId);
    }

    var teamId = league.userTeamId();
    var hiringState = hiringStates.find(teamId, phase);
    if (hiringState.isPresent() && hiringState.get().step() == HiringStep.HIRED) {
      return new MakeOfferResult.AlreadyHired(teamId);
    }

    var existing = offers.findActiveForTeam(teamId);
    if (existing.stream().anyMatch(o -> o.candidateId() == candidateId)) {
      return new MakeOfferResult.ActiveOfferExists(candidateId, teamId);
    }

    var phaseWeek = league.phaseWeek();
    var saved = offers.insertActive(candidateId, teamId, OfferTermsJson.toJson(terms), phaseWeek);
    log.info(
        "offer submitted leagueId={} teamId={} candidateId={} offerId={} week={}",
        leagueId,
        teamId,
        candidateId,
        saved.id(),
        phaseWeek);
    return new MakeOfferResult.Created(saved);
  }
}
