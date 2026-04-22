package app.zoneblitz.league.hiring.view;

import app.zoneblitz.league.hiring.OfferTerms;
import app.zoneblitz.league.staff.RoleScope;
import app.zoneblitz.league.staff.StaffContinuity;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * HTMX form record bound by {@link HiringHeadCoachController#submitOffer} when a franchise submits
 * a HC offer. Guaranteed-money arrives as an integer percent (0–100) and is converted to a fraction
 * on the way into {@link OfferTerms}. Compensation is rounded to the nearest $10,000 so the
 * offer-rounding convention is enforced even when the UI is bypassed.
 *
 * <p>{@code roleScope} and {@code staffContinuity} are filled with fixed placeholders during the
 * initial-staff-hiring phases — there is no existing staff or scoped role to negotiate against.
 * They remain on the wire format and in {@link OfferTerms} for future in-season reactivation.
 */
record MakeOfferForm(
    @NotNull BigDecimal compensation,
    @Min(1) int contractLengthYears,
    @Min(0) int guaranteedMoneyPct) {

  private static final BigDecimal COMP_ROUNDING = BigDecimal.valueOf(10_000);
  private static final BigDecimal PERCENT = BigDecimal.valueOf(100);

  OfferTerms toTerms() {
    var roundedComp =
        compensation.divide(COMP_ROUNDING, 0, RoundingMode.HALF_UP).multiply(COMP_ROUNDING);
    var guaranteedFraction =
        BigDecimal.valueOf(guaranteedMoneyPct).divide(PERCENT, 3, RoundingMode.HALF_UP);
    if (guaranteedFraction.compareTo(BigDecimal.ONE) > 0) {
      throw new IllegalArgumentException("guaranteedMoneyPct must be in [0,100]");
    }
    return new OfferTerms(
        roundedComp,
        contractLengthYears,
        guaranteedFraction,
        RoleScope.HIGH,
        StaffContinuity.BRING_OWN);
  }
}
