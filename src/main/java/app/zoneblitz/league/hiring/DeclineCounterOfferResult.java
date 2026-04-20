package app.zoneblitz.league.hiring;

/** Sealed outcome of {@link DeclineCounterOffer#decline}. */
sealed interface DeclineCounterOfferResult {

  record Declined(long offerId) implements DeclineCounterOfferResult {}

  record NotFound(long leagueId) implements DeclineCounterOfferResult {}

  record NotCounterPending(long offerId) implements DeclineCounterOfferResult {}
}
