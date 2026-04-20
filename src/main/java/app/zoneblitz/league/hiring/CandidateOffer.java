package app.zoneblitz.league.hiring;

import java.util.Objects;
import java.util.Optional;

/**
 * A team's offer to a candidate. {@code terms} JSON is generator/consumer-shaped. {@code stance} is
 * a per-tick derived view; it is {@code PRESENT} only for {@link OfferStatus#ACTIVE} offers, and is
 * empty for terminal offers.
 *
 * <p>{@code competingOfferId} and {@code counterDeadlineDay} are populated only while the offer is
 * in {@link OfferStatus#COUNTER_PENDING}. They must either both be present or both be absent.
 */
public record CandidateOffer(
    long id,
    long candidateId,
    long teamId,
    String terms,
    int submittedAtDay,
    OfferStatus status,
    Optional<OfferStance> stance,
    int revisionCount,
    Optional<Long> competingOfferId,
    Optional<Integer> counterDeadlineDay) {

  public CandidateOffer {
    Objects.requireNonNull(terms, "terms");
    Objects.requireNonNull(status, "status");
    Objects.requireNonNull(stance, "stance");
    Objects.requireNonNull(competingOfferId, "competingOfferId");
    Objects.requireNonNull(counterDeadlineDay, "counterDeadlineDay");
    if (revisionCount < 0) {
      throw new IllegalArgumentException("revisionCount must be >= 0");
    }
    if (competingOfferId.isPresent() != counterDeadlineDay.isPresent()) {
      throw new IllegalArgumentException(
          "competingOfferId and counterDeadlineDay must both be present or both absent");
    }
  }
}
