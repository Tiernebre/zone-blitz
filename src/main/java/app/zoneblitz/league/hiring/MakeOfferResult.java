package app.zoneblitz.league.hiring;

/**
 * Sealed outcome of {@link MakeOffer#offer}. {@code Created} covers both initial submissions and
 * revisions to an existing ACTIVE offer; callers don't need to branch. {@code RevisionCapReached}
 * means the offer exists but has hit {@link StanceEvaluator#REVISION_CAP} — the candidate has
 * walked in principle, resolver will reject on the next tick.
 */
public sealed interface MakeOfferResult {

  record Created(CandidateOffer offer) implements MakeOfferResult {}

  record NotFound(long leagueId) implements MakeOfferResult {}

  record UnknownCandidate(long candidateId) implements MakeOfferResult {}

  record AlreadyHired(long teamId) implements MakeOfferResult {}

  record CandidateNotInterested(long candidateId) implements MakeOfferResult {}

  record RevisionCapReached(long candidateId, int revisionCount) implements MakeOfferResult {}

  record OffersNotYetOpen(int phaseDay, int offersOpenOnDay) implements MakeOfferResult {}
}
