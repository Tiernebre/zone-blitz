package app.zoneblitz.league.hiring;

import app.zoneblitz.league.hiring.offer.StanceEvaluator;

/**
 * Sealed outcome of {@link MakeOffer#offer}. {@code Created} covers both initial submissions and
 * revisions to an existing ACTIVE offer; callers don't need to branch. {@code RevisionCapReached}
 * means the offer exists but has hit {@link StanceEvaluator#REVISION_CAP} — the candidate has
 * walked in principle, resolver will reject on the next tick. {@code InsufficientBudget} means the
 * submitting team's committed staff salary plus the offer's APY would exceed {@code
 * teams.staff_budget_cents} for the current season; no offer is persisted.
 */
public sealed interface MakeOfferResult {

  record Created(CandidateOffer offer) implements MakeOfferResult {}

  record NotFound(long leagueId) implements MakeOfferResult {}

  record UnknownCandidate(long candidateId) implements MakeOfferResult {}

  record AlreadyHired(long teamId) implements MakeOfferResult {}

  record CandidateNotInterested(long candidateId) implements MakeOfferResult {}

  record RevisionCapReached(long candidateId, int revisionCount) implements MakeOfferResult {}

  record OffersNotYetOpen(int phaseDay, int offersOpenOnDay) implements MakeOfferResult {}

  record InsufficientBudget(long teamId, long availableCents, long requiredCents)
      implements MakeOfferResult {}

  /**
   * The team already has a COUNTER_PENDING offer outstanding on this candidate — the user must
   * match or decline the counter before submitting another offer. Prevents violating the {@code
   * candidate_offers_one_outstanding_per_team} uniqueness constraint.
   */
  record CounterPendingOutstanding(long candidateId, long offerId) implements MakeOfferResult {}
}
