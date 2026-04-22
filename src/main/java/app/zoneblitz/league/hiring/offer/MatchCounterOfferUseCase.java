package app.zoneblitz.league.hiring.offer;

import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.hiring.MatchCounterOffer;
import app.zoneblitz.league.hiring.MatchCounterOfferResult;
import app.zoneblitz.league.hiring.OfferStatus;
import app.zoneblitz.league.hiring.hire.StaffBudgetRepository;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class MatchCounterOfferUseCase implements MatchCounterOffer {

  private static final Logger log = LoggerFactory.getLogger(MatchCounterOfferUseCase.class);

  private final LeagueRepository leagues;
  private final CandidateOfferRepository offers;
  private final StaffBudgetRepository budgets;

  public MatchCounterOfferUseCase(
      LeagueRepository leagues, CandidateOfferRepository offers, StaffBudgetRepository budgets) {
    this.leagues = leagues;
    this.offers = offers;
    this.budgets = budgets;
  }

  @Override
  @Transactional
  public MatchCounterOfferResult match(long leagueId, long offerId, String ownerSubject) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");

    var maybeLeague = leagues.findSummaryByIdAndOwner(leagueId, ownerSubject);
    if (maybeLeague.isEmpty()) {
      return new MatchCounterOfferResult.NotFound(leagueId);
    }
    var league = maybeLeague.get();

    var maybeOffer = offers.findById(offerId);
    if (maybeOffer.isEmpty() || maybeOffer.get().teamId() != league.userTeamId()) {
      return new MatchCounterOfferResult.NotFound(leagueId);
    }
    var offer = maybeOffer.get();

    if (offer.status() != OfferStatus.COUNTER_PENDING) {
      return new MatchCounterOfferResult.NotCounterPending(offerId);
    }

    var deadlineDay = offer.counterDeadlineDay().orElseThrow();
    if (league.phaseDay() > deadlineDay) {
      return new MatchCounterOfferResult.DeadlineExpired(offerId, deadlineDay, league.phaseDay());
    }

    var competingOfferId = offer.competingOfferId().orElseThrow();
    var maybeCompeting = offers.findById(competingOfferId);
    if (maybeCompeting.isEmpty()) {
      return new MatchCounterOfferResult.NotFound(leagueId);
    }
    var competing = maybeCompeting.get();
    var newTerms = OfferTermsJson.fromJson(competing.terms());
    var newApyCents = newTerms.compensation().movePointRight(2).longValueExact();

    var currentTerms = OfferTermsJson.fromJson(offer.terms());
    var currentApyCents = currentTerms.compensation().movePointRight(2).longValueExact();

    var budget = budgets.committed(league.userTeamId(), league.season());
    var projectedCommitted = budget.committedCents() - currentApyCents + newApyCents;
    if (projectedCommitted > budget.budgetCents()) {
      var available =
          Math.max(0L, budget.budgetCents() - (budget.committedCents() - currentApyCents));
      return new MatchCounterOfferResult.InsufficientBudget(
          league.userTeamId(), available, newApyCents);
    }

    var updated = offers.acceptCounter(offerId, OfferTermsJson.toJson(newTerms), league.phaseDay());
    log.info(
        "counter matched leagueId={} teamId={} offerId={} competingOfferId={} day={}",
        leagueId,
        league.userTeamId(),
        offerId,
        competingOfferId,
        league.phaseDay());
    return new MatchCounterOfferResult.Matched(updated);
  }
}
