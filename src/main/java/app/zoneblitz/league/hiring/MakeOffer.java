package app.zoneblitz.league.hiring;

/**
 * Use case: a franchise submits an offer to a Head Coach candidate. One offer per (franchise,
 * candidate) at a time — re-submitting while an {@link OfferStatus#ACTIVE} offer exists returns
 * {@link MakeOfferResult.ActiveOfferExists}. Offer is resolved at the next day tick by {@link
 * OfferResolver}.
 */
public interface MakeOffer {

  /**
   * Submit an offer on behalf of the requester's franchise.
   *
   * @param leagueId the league.
   * @param candidateId the candidate being pursued.
   * @param ownerSubject OAuth subject of the user owning the franchise submitting the offer.
   * @param terms offer terms; must be valid per {@link OfferTerms} invariants.
   * @return one of:
   *     <ul>
   *       <li>{@link MakeOfferResult.Created} — offer persisted as ACTIVE.
   *       <li>{@link MakeOfferResult.NotFound} — league not found for the caller.
   *       <li>{@link MakeOfferResult.UnknownCandidate} — candidate missing, not in HC pool, or
   *           already hired by any franchise.
   *       <li>{@link MakeOfferResult.AlreadyHired} — caller's franchise has already hired a HC in
   *           this league.
   *       <li>{@link MakeOfferResult.ActiveOfferExists} — caller already has an active offer on
   *           this candidate.
   *     </ul>
   */
  MakeOfferResult offer(long leagueId, long candidateId, String ownerSubject, OfferTerms terms);
}
