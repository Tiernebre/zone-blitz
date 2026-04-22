package app.zoneblitz.league.hiring;

/** Sealed outcome of {@link MatchCounterOffer#match}. */
public sealed interface MatchCounterOfferResult {

  record Matched(CandidateOffer offer) implements MatchCounterOfferResult {}

  record NotFound(long leagueId) implements MatchCounterOfferResult {}

  record NotCounterPending(long offerId) implements MatchCounterOfferResult {}

  record InsufficientBudget(long teamId, long availableCents, long requiredCents)
      implements MatchCounterOfferResult {}

  record DeadlineExpired(long offerId, int deadlineDay, int currentDay)
      implements MatchCounterOfferResult {}
}
