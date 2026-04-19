package app.zoneblitz.league.hiring;

import app.zoneblitz.league.team.TeamProfile;
import java.math.BigDecimal;

/**
 * Pure, stateless interest-scoring for interviews. Evaluates only the team-side preference
 * dimensions (categorical market/geography/climate/window/scheme and numeric prestige/owner
 * stability/facility quality) — offer-dependent dimensions (compensation, contract length,
 * guaranteed money, role scope, staff continuity) are intentionally excluded because no offer
 * exists at interview time.
 *
 * <p>The weighted fit score is normalized by the sum of the considered dimensions' weights, then
 * bucketed into {@link InterviewInterest}. The result is deterministic: re-interviewing the same
 * candidate with the same team profile always yields the same bucket.
 */
public final class InterestScoring {

  static final double INTERESTED_THRESHOLD = 0.66;
  static final double LUKEWARM_THRESHOLD = 0.33;

  private InterestScoring() {}

  public static InterviewInterest score(TeamProfile team, CandidatePreferences prefs) {
    var n = normalizedScore(team, prefs);
    if (n >= INTERESTED_THRESHOLD) {
      return InterviewInterest.INTERESTED;
    }
    if (n >= LUKEWARM_THRESHOLD) {
      return InterviewInterest.LUKEWARM;
    }
    return InterviewInterest.NOT_INTERESTED;
  }

  /**
   * Normalized fit score in {@code [0,1]}. Consumers (CPU ranking) use this; humans see buckets.
   */
  public static double normalizedScore(TeamProfile team, CandidatePreferences prefs) {
    var weighted = 0.0;
    var totalWeight = 0.0;

    weighted += weight(prefs.marketSizeWeight()) * fit(prefs.marketSizeTarget(), team.marketSize());
    totalWeight += weight(prefs.marketSizeWeight());

    weighted += weight(prefs.geographyWeight()) * fit(prefs.geographyTarget(), team.geography());
    totalWeight += weight(prefs.geographyWeight());

    weighted += weight(prefs.climateWeight()) * fit(prefs.climateTarget(), team.climate());
    totalWeight += weight(prefs.climateWeight());

    weighted +=
        weight(prefs.franchisePrestigeWeight())
            * floorFit(prefs.franchisePrestigeTarget(), team.prestige());
    totalWeight += weight(prefs.franchisePrestigeWeight());

    weighted +=
        weight(prefs.competitiveWindowWeight())
            * fit(prefs.competitiveWindowTarget(), team.window());
    totalWeight += weight(prefs.competitiveWindowWeight());

    weighted +=
        weight(prefs.schemeAlignmentWeight())
            * fit(prefs.schemeAlignmentTarget(), team.schemeAlignment());
    totalWeight += weight(prefs.schemeAlignmentWeight());

    weighted +=
        weight(prefs.ownerStabilityWeight())
            * floorFit(prefs.ownerStabilityTarget(), team.ownerStability());
    totalWeight += weight(prefs.ownerStabilityWeight());

    weighted +=
        weight(prefs.facilityQualityWeight())
            * floorFit(prefs.facilityQualityTarget(), team.facilityQuality());
    totalWeight += weight(prefs.facilityQualityWeight());

    return totalWeight <= 0.0 ? 0.0 : weighted / totalWeight;
  }

  private static double weight(BigDecimal w) {
    return w.doubleValue();
  }

  private static double fit(Object target, Object actual) {
    return target.equals(actual) ? 1.0 : 0.0;
  }

  private static double floorFit(BigDecimal target, BigDecimal actual) {
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
}
