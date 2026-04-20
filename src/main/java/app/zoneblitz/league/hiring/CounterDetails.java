package app.zoneblitz.league.hiring;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * View-layer record describing the counter-offer state of a {@link OfferStatus#COUNTER_PENDING}
 * offer. Embedded in {@code OfferView} when the offer is counter-pending; consumed by the UI to
 * render the competing terms, deadline, and match/walk affordances.
 *
 * <p>{@link #daysRemaining()} may be zero or negative when the resolver has not yet swept the
 * window closed — the counter is effectively expired but still visible in that intra-tick gap.
 */
record CounterDetails(
    long competingOfferId,
    BigDecimal competingCompensation,
    int competingContractYears,
    BigDecimal competingGuaranteedMoneyPct,
    int deadlineDay,
    int currentDay) {

  CounterDetails {
    Objects.requireNonNull(competingCompensation, "competingCompensation");
    Objects.requireNonNull(competingGuaranteedMoneyPct, "competingGuaranteedMoneyPct");
  }

  int daysRemaining() {
    return deadlineDay - currentDay;
  }
}
