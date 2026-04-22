package app.zoneblitz.league.hiring.hire;

import app.zoneblitz.league.hiring.CandidatePreferences;
import app.zoneblitz.league.hiring.InterviewInterest;
import app.zoneblitz.league.team.TeamProfile;
import java.math.BigDecimal;

/**
 * Pure, stateless interest-scoring for interviews. Evaluates only the team-side preference
 * dimensions that carry real signal in the v1 expansion-league setup: {@code market}, {@code
 * geography}, and {@code climate} (sourced from the team's franchise city).
 *
 * <p>Deliberately excluded:
 *
 * <ul>
 *   <li>Offer-dependent dims (compensation, contract length, guaranteed money, role scope, staff
 *       continuity) — no offer exists at interview time.
 *   <li>Scheme alignment — the incoming head coach sets the team's scheme; it isn't a team
 *       attribute the candidate is evaluating.
 *   <li>Franchise prestige, owner stability, facility quality, competitive window — documented "v1
 *       equal-footing" constants in {@code CityTeamProfiles} (see {@code
 *       docs/technical/league-phases.md}). Because every team reports the same value, these
 *       dimensions cannot differentiate teams and only reflect candidate target variance. Promote
 *       them back into interest scoring once real team ratings land.
 * </ul>
 *
 * <p>The weighted fit score is normalized by the sum of the considered dimensions' weights, then
 * bucketed into {@link InterviewInterest}. The result is deterministic: re-interviewing the same
 * candidate with the same team profile always yields the same bucket.
 */
public final class InterestScoring {

  static final double INTERESTED_THRESHOLD = 0.55;
  static final double LUKEWARM_THRESHOLD = 0.25;

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

    weighted +=
        weight(prefs.marketSizeWeight()) * ordinalFit(prefs.marketSizeTarget(), team.marketSize());
    totalWeight += weight(prefs.marketSizeWeight());

    weighted += weight(prefs.geographyWeight()) * fit(prefs.geographyTarget(), team.geography());
    totalWeight += weight(prefs.geographyWeight());

    weighted += weight(prefs.climateWeight()) * ordinalFit(prefs.climateTarget(), team.climate());
    totalWeight += weight(prefs.climateWeight());

    return totalWeight <= 0.0 ? 0.0 : weighted / totalWeight;
  }

  private static double weight(BigDecimal w) {
    return w.doubleValue();
  }

  private static double fit(Object target, Object actual) {
    return target.equals(actual) ? 1.0 : 0.0;
  }

  private static <E extends Enum<E>> double ordinalFit(E target, E actual) {
    var diff = Math.abs(target.ordinal() - actual.ordinal());
    return switch (diff) {
      case 0 -> 1.0;
      case 1 -> 0.5;
      default -> 0.0;
    };
  }
}
