package app.zoneblitz.league.hiring.offer;

import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.hiring.DeclineCounterOffer;
import app.zoneblitz.league.hiring.DeclineCounterOfferResult;
import app.zoneblitz.league.hiring.OfferStatus;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class DeclineCounterOfferUseCase implements DeclineCounterOffer {

  private static final Logger log = LoggerFactory.getLogger(DeclineCounterOfferUseCase.class);

  private final LeagueRepository leagues;
  private final CandidateOfferRepository offers;

  public DeclineCounterOfferUseCase(LeagueRepository leagues, CandidateOfferRepository offers) {
    this.leagues = leagues;
    this.offers = offers;
  }

  @Override
  @Transactional
  public DeclineCounterOfferResult decline(long leagueId, long offerId, String ownerSubject) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");

    var maybeLeague = leagues.findSummaryByIdAndOwner(leagueId, ownerSubject);
    if (maybeLeague.isEmpty()) {
      return new DeclineCounterOfferResult.NotFound(leagueId);
    }
    var league = maybeLeague.get();

    var maybeOffer = offers.findById(offerId);
    if (maybeOffer.isEmpty() || maybeOffer.get().teamId() != league.userTeamId()) {
      return new DeclineCounterOfferResult.NotFound(leagueId);
    }
    var offer = maybeOffer.get();

    if (offer.status() != OfferStatus.COUNTER_PENDING) {
      return new DeclineCounterOfferResult.NotCounterPending(offerId);
    }

    offers.resolve(offerId, OfferStatus.REJECTED);
    log.info(
        "counter declined leagueId={} teamId={} offerId={} day={}",
        leagueId,
        league.userTeamId(),
        offerId,
        league.phaseDay());
    return new DeclineCounterOfferResult.Declined(offerId);
  }
}
