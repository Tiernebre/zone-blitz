package app.zoneblitz.league.hiring;

/**
 * Use case: the owner of a {@link OfferStatus#COUNTER_PENDING} offer accepts the competing offer's
 * terms onto their own offer. The offer returns to {@link OfferStatus#ACTIVE} with stance {@link
 * OfferStance#PENDING} so the next resolver tick re-scores it against the updated terms.
 */
public interface MatchCounterOffer {

  /**
   * Match the competing offer on {@code offerId}.
   *
   * @param leagueId the league containing the offer.
   * @param offerId the counter-pending offer owned by the caller's team.
   * @param ownerSubject OAuth subject of the user owning the franchise whose offer this is.
   * @return one of:
   *     <ul>
   *       <li>{@link MatchCounterOfferResult.Matched} — offer flipped to ACTIVE with the competing
   *           offer's APY / contract length / guarantee; {@code revision_count} incremented and
   *           {@code submitted_at_day} set so the next tick re-scores.
   *       <li>{@link MatchCounterOfferResult.NotFound} — league missing, not owned by the caller,
   *           or the offer's team is not the caller's team.
   *       <li>{@link MatchCounterOfferResult.NotCounterPending} — offer exists but its status is
   *           not {@link OfferStatus#COUNTER_PENDING}.
   *       <li>{@link MatchCounterOfferResult.InsufficientBudget} — projected committed salary
   *           (current committed minus this offer's current APY plus the competing APY) exceeds
   *           {@code teams.staff_budget_cents} for the current season. The offer remains
   *           COUNTER_PENDING until the user declines or the deadline expires.
   *       <li>{@link MatchCounterOfferResult.DeadlineExpired} — the league's phase day is past the
   *           counter deadline; the resolver has not yet swept it to REJECTED but the match window
   *           is closed.
   *     </ul>
   */
  MatchCounterOfferResult match(long leagueId, long offerId, String ownerSubject);
}
