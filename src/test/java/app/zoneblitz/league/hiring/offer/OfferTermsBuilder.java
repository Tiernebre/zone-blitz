package app.zoneblitz.league.hiring.offer;

import app.zoneblitz.league.hiring.OfferTerms;
import app.zoneblitz.league.staff.RoleScope;
import app.zoneblitz.league.staff.StaffContinuity;
import java.math.BigDecimal;

/**
 * Fluent builder for {@link OfferTerms} in test code. Defaults produce a plausible valid instance
 * (mid-market HC compensation, 5-year contract, 85% guaranteed, HIGH role scope, BRING_OWN
 * continuity); {@code with*} methods override individual fields.
 */
final class OfferTermsBuilder {

  private BigDecimal compensation = new BigDecimal("8500000.00");
  private int contractLengthYears = 5;
  private BigDecimal guaranteedMoneyPct = new BigDecimal("0.85");
  private RoleScope roleScope = RoleScope.HIGH;
  private StaffContinuity staffContinuity = StaffContinuity.BRING_OWN;

  static OfferTermsBuilder anOfferTerms() {
    return new OfferTermsBuilder();
  }

  OfferTermsBuilder withCompensation(BigDecimal compensation) {
    this.compensation = compensation;
    return this;
  }

  OfferTermsBuilder withCompensation(String compensation) {
    this.compensation = new BigDecimal(compensation);
    return this;
  }

  OfferTermsBuilder withContractLengthYears(int contractLengthYears) {
    this.contractLengthYears = contractLengthYears;
    return this;
  }

  OfferTermsBuilder withGuaranteedMoneyPct(BigDecimal guaranteedMoneyPct) {
    this.guaranteedMoneyPct = guaranteedMoneyPct;
    return this;
  }

  OfferTermsBuilder withGuaranteedMoneyPct(String guaranteedMoneyPct) {
    this.guaranteedMoneyPct = new BigDecimal(guaranteedMoneyPct);
    return this;
  }

  OfferTermsBuilder withRoleScope(RoleScope roleScope) {
    this.roleScope = roleScope;
    return this;
  }

  OfferTermsBuilder withStaffContinuity(StaffContinuity staffContinuity) {
    this.staffContinuity = staffContinuity;
    return this;
  }

  OfferTerms build() {
    return new OfferTerms(
        compensation, contractLengthYears, guaranteedMoneyPct, roleScope, staffContinuity);
  }
}
