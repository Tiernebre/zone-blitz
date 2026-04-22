package app.zoneblitz.league.hiring;

import app.zoneblitz.league.hiring.offer.OfferResolver;

/**
 * Use case: a franchise submits an offer to a Head Coach candidate. One offer per (franchise,
 * candidate) at a time — re-submitting while an {@link OfferStatus#ACTIVE} offer exists revises the
 * existing offer in place and returns {@link MakeOfferResult.Created}. Offer is resolved at the
 * next day tick by {@link OfferResolver}.
 */
public interface MakeOffer {

  /**
   * League-wide interview-only window. Offers may only be submitted on phase days &gt;= this value.
   * Days 1..{@code OFFERS_OPEN_ON_DAY - 1} are reserved for interviews so every franchise (user and
   * CPU) has time to vet a shortlist before negotiations begin.
   */
  int OFFERS_OPEN_ON_DAY = 4;

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
   *       <li>{@link MakeOfferResult.OffersNotYetOpen} — current phase day is inside the
   *           interview-only window ({@code phaseDay < OFFERS_OPEN_ON_DAY}).
   *       <li>{@link MakeOfferResult.InsufficientBudget} — this offer's APY plus the team's
   *           already-committed staff salary for the current season would exceed {@code
   *           teams.staff_budget_cents}. Offer is not persisted; caller should surface the cap
   *           breach to the user.
   *     </ul>
   */
  MakeOfferResult offer(long leagueId, long candidateId, String ownerSubject, OfferTerms terms);
}
