package app.zoneblitz.league.hiring;

import app.zoneblitz.league.staff.RoleScope;
import app.zoneblitz.league.staff.StaffContinuity;
import java.math.BigDecimal;
import java.util.Objects;

/**
 * Typed offer terms a franchise presents to a candidate. Serialized to the {@code terms} JSONB
 * column on {@code candidate_offers}. Matches the offer-sourced dimensions in the preference
 * scoring function ({@code compensation}, {@code contract_length}, {@code guaranteed_money}, {@code
 * role_scope}, {@code staff_continuity}).
 */
public record OfferTerms(
    BigDecimal compensation,
    int contractLengthYears,
    BigDecimal guaranteedMoneyPct,
    RoleScope roleScope,
    StaffContinuity staffContinuity) {

  public OfferTerms {
    Objects.requireNonNull(compensation, "compensation");
    Objects.requireNonNull(guaranteedMoneyPct, "guaranteedMoneyPct");
    Objects.requireNonNull(roleScope, "roleScope");
    Objects.requireNonNull(staffContinuity, "staffContinuity");
    if (compensation.signum() < 0) {
      throw new IllegalArgumentException("compensation must be >= 0");
    }
    if (contractLengthYears <= 0) {
      throw new IllegalArgumentException("contractLengthYears must be > 0");
    }
    if (guaranteedMoneyPct.signum() < 0 || guaranteedMoneyPct.compareTo(BigDecimal.ONE) > 0) {
      throw new IllegalArgumentException("guaranteedMoneyPct must be in [0,1]");
    }
  }
}
