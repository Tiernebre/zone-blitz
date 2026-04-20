package app.zoneblitz.league.hiring;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;
import java.util.Optional;

/**
 * Row view-model for one of the requesting team's offers to a candidate. Surfaces offers in either
 * {@link OfferStatus#ACTIVE} or {@link OfferStatus#COUNTER_PENDING}; terminal (ACCEPTED / REJECTED)
 * offers don't appear in the hiring UI. {@code counterDetails} is populated iff the underlying
 * offer is counter-pending.
 */
public record OfferView(
    long id,
    BigDecimal compensation,
    int contractLengthYears,
    BigDecimal guaranteedMoneyPct,
    OfferStance stance,
    int revisionCount,
    int revisionCap,
    Optional<String> directionalHint,
    Optional<CounterDetails> counterDetails) {

  public OfferView {
    Objects.requireNonNull(compensation, "compensation");
    Objects.requireNonNull(guaranteedMoneyPct, "guaranteedMoneyPct");
    Objects.requireNonNull(stance, "stance");
    Objects.requireNonNull(directionalHint, "directionalHint");
    Objects.requireNonNull(counterDetails, "counterDetails");
  }

  public boolean canRevise() {
    return revisionCount < revisionCap;
  }

  public boolean isAgreed() {
    return stance == OfferStance.AGREED;
  }

  public boolean isCounterPending() {
    return counterDetails.isPresent();
  }

  public int guaranteedMoneyPctWhole() {
    return guaranteedMoneyPct
        .multiply(BigDecimal.valueOf(100L))
        .setScale(0, RoundingMode.HALF_UP)
        .intValueExact();
  }
}
