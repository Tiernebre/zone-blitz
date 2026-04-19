package app.zoneblitz.league;

import java.math.BigDecimal;

/**
 * Pure, stateless preference-scoring functions. The per-dimension fit {@code fit_d} is normalized
 * to {@code [0, 1]} and combined as a weighted sum:
 *
 * <pre>
 *   score = Σ over dimensions d of: weight_d * fit_d(target_d, franchise_or_offer_value_d)
 * </pre>
 *
 * See {@code docs/technical/league-phases.md} — "Candidate preferences" and "Dimensions" tables.
 * Numeric targets use a saturating asymmetric ramp (floor-style) for compensation /
 * guaranteed-money and a symmetric bell for contract length. Categorical fits are exact-match.
 */
final class OfferScoring {

  private OfferScoring() {}

  /**
   * Compute the composite preference score for an offer from a franchise against a candidate's
   * preferences.
   */
  static double score(OfferTerms offer, FranchiseProfile franchise, CandidatePreferences prefs) {
    double total = 0.0;
    total += weighted(prefs.compensationWeight(), compensationFit(prefs, offer));
    total += weighted(prefs.contractLengthWeight(), contractLengthFit(prefs, offer));
    total += weighted(prefs.guaranteedMoneyWeight(), guaranteedMoneyFit(prefs, offer));
    total +=
        weighted(
            prefs.marketSizeWeight(),
            categoricalFit(prefs.marketSizeTarget(), franchise.marketSize()));
    total +=
        weighted(
            prefs.geographyWeight(),
            categoricalFit(prefs.geographyTarget(), franchise.geography()));
    total +=
        weighted(prefs.climateWeight(), categoricalFit(prefs.climateTarget(), franchise.climate()));
    total +=
        weighted(
            prefs.franchisePrestigeWeight(),
            numericFloorFit(prefs.franchisePrestigeTarget(), franchise.prestige(), 100.0));
    total +=
        weighted(
            prefs.competitiveWindowWeight(),
            categoricalFit(prefs.competitiveWindowTarget(), franchise.window()));
    total +=
        weighted(
            prefs.roleScopeWeight(), categoricalFit(prefs.roleScopeTarget(), offer.roleScope()));
    total +=
        weighted(
            prefs.staffContinuityWeight(),
            categoricalFit(prefs.staffContinuityTarget(), offer.staffContinuity()));
    total +=
        weighted(
            prefs.schemeAlignmentWeight(),
            categoricalFit(prefs.schemeAlignmentTarget(), franchise.schemeAlignment()));
    total +=
        weighted(
            prefs.ownerStabilityWeight(),
            numericFloorFit(prefs.ownerStabilityTarget(), franchise.ownerStability(), 100.0));
    total +=
        weighted(
            prefs.facilityQualityWeight(),
            numericFloorFit(prefs.facilityQualityTarget(), franchise.facilityQuality(), 100.0));
    return total;
  }

  private static double weighted(BigDecimal weight, double fit) {
    return weight.doubleValue() * fit;
  }

  private static double categoricalFit(Object target, Object actual) {
    return target.equals(actual) ? 1.0 : 0.0;
  }

  /**
   * Floor-style fit: meets-or-exceeds target → 1.0; below target drops linearly; full zero at 50%
   * of target. Used for compensation, guaranteed money, and 0..{@code scale} ratings.
   */
  private static double numericFloorFit(BigDecimal target, BigDecimal actual, double scale) {
    var t = target.doubleValue();
    var a = actual.doubleValue();
    if (t <= 0.0) {
      return 1.0;
    }
    if (a >= t) {
      return 1.0;
    }
    var floor = Math.max(0.0, t * 0.5);
    if (a <= floor) {
      return 0.0;
    }
    return (a - floor) / (t - floor);
  }

  private static double compensationFit(CandidatePreferences prefs, OfferTerms offer) {
    return numericFloorFit(prefs.compensationTarget(), offer.compensation(), 0.0);
  }

  private static double guaranteedMoneyFit(CandidatePreferences prefs, OfferTerms offer) {
    return numericFloorFit(prefs.guaranteedMoneyTarget(), offer.guaranteedMoneyPct(), 1.0);
  }

  /**
   * Symmetric bell around contract-length target. 1.0 at target; linearly drops to 0.0 at ±3 years.
   */
  private static double contractLengthFit(CandidatePreferences prefs, OfferTerms offer) {
    var diff = Math.abs(offer.contractLengthYears() - prefs.contractLengthTarget());
    if (diff == 0) {
      return 1.0;
    }
    if (diff >= 3) {
      return 0.0;
    }
    return 1.0 - (diff / 3.0);
  }
}
