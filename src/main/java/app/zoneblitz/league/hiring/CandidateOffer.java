package app.zoneblitz.league.hiring;

import java.util.Objects;
import java.util.Optional;

/**
 * A team's offer to a candidate. {@code terms} JSON is generator/consumer-shaped. {@code stance} is
 * a per-tick derived view; it is {@code PRESENT} only for {@link OfferStatus#ACTIVE} offers, and is
 * empty for terminal offers.
 */
public record CandidateOffer(
    long id,
    long candidateId,
    long teamId,
    String terms,
    int submittedAtWeek,
    OfferStatus status,
    Optional<OfferStance> stance,
    int revisionCount) {

  public CandidateOffer {
    Objects.requireNonNull(terms, "terms");
    Objects.requireNonNull(status, "status");
    Objects.requireNonNull(stance, "stance");
    if (revisionCount < 0) {
      throw new IllegalArgumentException("revisionCount must be >= 0");
    }
  }
}
