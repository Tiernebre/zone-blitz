package app.zoneblitz.league.hiring;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Builds a {@link NewStaffContract} from the offer terms a candidate just accepted. APY is the
 * dollar compensation converted to cents; guarantee is APY × contract years × guaranteed-money %.
 */
final class StaffContractFactory {

  private StaffContractFactory() {}

  static NewStaffContract fromTerms(
      long teamId, long candidateId, long teamStaffId, OfferTerms terms, int startSeason) {
    var apyCents = terms.compensation().movePointRight(2).longValueExact();
    var years = terms.contractLengthYears();
    var totalValueCents = BigDecimal.valueOf(apyCents).multiply(BigDecimal.valueOf(years));
    var guaranteeCents =
        totalValueCents
            .multiply(terms.guaranteedMoneyPct())
            .setScale(0, RoundingMode.HALF_UP)
            .longValueExact();
    return new NewStaffContract(
        teamId,
        candidateId,
        teamStaffId,
        apyCents,
        guaranteeCents,
        years,
        startSeason,
        startSeason + years - 1);
  }
}
