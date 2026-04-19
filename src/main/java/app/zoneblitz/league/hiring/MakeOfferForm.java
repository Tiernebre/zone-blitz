package app.zoneblitz.league;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * HTMX form record bound by {@link HiringHeadCoachController#submitOffer} when a franchise submits
 * a HC offer. All fields map directly onto the typed {@link OfferTerms} payload.
 */
record MakeOfferForm(
    @NotNull @DecimalMin("0.0") BigDecimal compensation,
    @Min(1) int contractLengthYears,
    @NotNull @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal guaranteedMoneyPct,
    @NotNull RoleScope roleScope,
    @NotNull StaffContinuity staffContinuity) {

  OfferTerms toTerms() {
    return new OfferTerms(
        compensation, contractLengthYears, guaranteedMoneyPct, roleScope, staffContinuity);
  }
}
