package app.zoneblitz.league;

public sealed interface MakeOfferResult {

  record Created(CandidateOffer offer) implements MakeOfferResult {}

  record NotFound(long leagueId) implements MakeOfferResult {}

  record UnknownCandidate(long candidateId) implements MakeOfferResult {}

  record AlreadyHired(long teamId) implements MakeOfferResult {}

  record ActiveOfferExists(long candidateId, long teamId) implements MakeOfferResult {}
}
