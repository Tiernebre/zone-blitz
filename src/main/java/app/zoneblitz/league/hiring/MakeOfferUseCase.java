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
  private final TeamInterviewRepository interviews;
  private final StaffBudgetRepository budgets;

  public MakeOfferUseCase(
      LeagueRepository leagues,
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidateOfferRepository offers,
      TeamHiringStateRepository hiringStates,
      TeamInterviewRepository interviews,
      StaffBudgetRepository budgets) {
    this.leagues = leagues;
    this.pools = pools;
    this.candidates = candidates;
    this.offers = offers;
    this.hiringStates = hiringStates;
    this.interviews = interviews;
    this.budgets = budgets;
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

    var interview =
        interviews.findAllFor(teamId, phase).stream()
            .filter(i -> i.candidateId() == candidateId)
            .findFirst();
    if (interview.isEmpty()
        || interview.get().interestLevel() == InterviewInterest.NOT_INTERESTED) {
      return new MakeOfferResult.CandidateNotInterested(candidateId);
    }

    var phaseDay = league.phaseDay();
    if (phaseDay < MakeOffer.OFFERS_OPEN_ON_DAY) {
      return new MakeOfferResult.OffersNotYetOpen(phaseDay, MakeOffer.OFFERS_OPEN_ON_DAY);
    }

    var apyCents = terms.compensation().movePointRight(2).longValueExact();
    var budget = budgets.committed(teamId, league.season());
    var existing = offers.findActiveForTeamAndCandidate(teamId, candidateId);
    var existingApyCents =
        existing
            .map(o -> OfferTermsJson.fromJson(o.terms()))
            .map(t -> t.compensation().movePointRight(2).longValueExact())
            .orElse(0L);
    var projectedCommitted = budget.committedCents() - existingApyCents + apyCents;
    if (projectedCommitted > budget.budgetCents()) {
      var available =
          Math.max(0L, budget.budgetCents() - (budget.committedCents() - existingApyCents));
      return new MakeOfferResult.InsufficientBudget(teamId, available, apyCents);
    }

    if (existing.isPresent()) {
      if (existing.get().revisionCount() >= StanceEvaluator.REVISION_CAP) {
        return new MakeOfferResult.RevisionCapReached(candidateId, existing.get().revisionCount());
      }
      var revised = offers.revise(existing.get().id(), OfferTermsJson.toJson(terms), phaseDay);
      log.info(
          "offer revised leagueId={} teamId={} candidateId={} offerId={} revision={} day={}",
          leagueId,
          teamId,
          candidateId,
          revised.id(),
          revised.revisionCount(),
          phaseDay);
      return new MakeOfferResult.Created(revised);
    }

    var saved = offers.insertActive(candidateId, teamId, OfferTermsJson.toJson(terms), phaseDay);
    log.info(
        "offer submitted leagueId={} teamId={} candidateId={} offerId={} day={}",
        leagueId,
        teamId,
        candidateId,
        saved.id(),
        phaseDay);
    return new MakeOfferResult.Created(saved);
  }
}
