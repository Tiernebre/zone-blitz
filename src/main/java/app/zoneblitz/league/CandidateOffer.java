package app.zoneblitz.league;

import java.util.Objects;

/** A franchise's offer to a candidate. Terms JSON is generator/consumer-shaped. */
public record CandidateOffer(
    long id,
    long candidateId,
    long franchiseId,
    String terms,
    int submittedAtWeek,
    OfferStatus status) {

  public CandidateOffer {
    Objects.requireNonNull(terms, "terms");
    Objects.requireNonNull(status, "status");
  }
}
