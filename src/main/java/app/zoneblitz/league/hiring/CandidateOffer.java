package app.zoneblitz.league.hiring;

import java.util.Objects;

/** A team's offer to a candidate. Terms JSON is generator/consumer-shaped. */
public record CandidateOffer(
    long id, long candidateId, long teamId, String terms, int submittedAtWeek, OfferStatus status) {

  public CandidateOffer {
    Objects.requireNonNull(terms, "terms");
    Objects.requireNonNull(status, "status");
  }
}
