package app.zoneblitz.league.hiring;

public sealed interface HireCandidateResult {

  record Hired(long candidateId, long teamId) implements HireCandidateResult {}

  record NotFound(long leagueId) implements HireCandidateResult {}

  record UnknownCandidate(long candidateId) implements HireCandidateResult {}

  record NoAgreedOffer(long candidateId) implements HireCandidateResult {}

  record AlreadyHired(long teamId) implements HireCandidateResult {}
}
