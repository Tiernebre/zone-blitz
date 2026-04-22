package app.zoneblitz.league.hiring;

/**
 * Use case: the owner of a {@link OfferStatus#COUNTER_PENDING} offer walks from the counter, moving
 * the offer to {@link OfferStatus#REJECTED}. Budget is never checked — declining frees commitment,
 * never uses it.
 */
public interface DeclineCounterOffer {

  /**
   * Decline the counter on {@code offerId}.
   *
   * @param leagueId the league containing the offer.
   * @param offerId the counter-pending offer owned by the caller's team.
   * @param ownerSubject OAuth subject of the user owning the franchise whose offer this is.
   * @return one of:
   *     <ul>
   *       <li>{@link DeclineCounterOfferResult.Declined} — offer transitioned to {@link
   *           OfferStatus#REJECTED}.
   *       <li>{@link DeclineCounterOfferResult.NotFound} — league missing, not owned by the caller,
   *           or the offer's team is not the caller's team.
   *       <li>{@link DeclineCounterOfferResult.NotCounterPending} — offer exists but its status is
   *           not {@link OfferStatus#COUNTER_PENDING}.
   *     </ul>
   */
  DeclineCounterOfferResult decline(long leagueId, long offerId, String ownerSubject);
}
