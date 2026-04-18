package app.zoneblitz.gamesimulator.playcalling;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.roster.CoachTendencies;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Pure math that turns a {@link CoachTendencies} + {@link Situation} pair into the additive /
 * multiplicative shifts applied against league-average bands. All functions are side-effect-free
 * and deterministic — randomness is the caller's problem.
 *
 * <p>Tendency axes are 0–100 and centre at 50; every shift uses {@code (axis - 50) / 50} so a
 * neutral coach produces a zero shift and the band's baseline is reproduced unchanged. Shift
 * magnitudes are bounded by documented caps so situational priors always dominate tendencies.
 */
final class TendencyShifts {

  private TendencyShifts() {}

  /** Max logit-space pass-rate shift from a fully pass-happy (or run-heavy) coach. */
  static final double PASS_RATE_MAX_LOGIT_SHIFT = 0.6;

  /** Weights applied to the score-time and field-zone priors when blending with down-distance. */
  static final double SCORE_TIME_WEIGHT = 0.5;

  static final double FIELD_ZONE_WEIGHT = 0.3;

  /** Max multiplicative boost/cut applied to a concept weight from a single tendency axis. */
  private static final double CONCEPT_MAX_MULTIPLIER = 1.8;

  private static final double CONCEPT_MIN_MULTIPLIER = 1.0 / CONCEPT_MAX_MULTIPLIER;

  /** Clamp a tendency axis to a normalized {@code [-1, 1]} delta. */
  static double normalize(int axis) {
    return Math.max(-1.0, Math.min(1.0, (axis - 50) / 50.0));
  }

  /**
   * Blend the three pass-rate priors (down-distance as the anchor) in logit space, then add the
   * coach's pass-heaviness shift. Late-game clock awareness amplifies the score-time signal.
   */
  static double blendedPassRate(
      PlayCallBands bands, Situation situation, CoachTendencies tendencies) {
    var base = logit(bands.passRateForDownDistance(situation));
    var scoreTimeDelta =
        logit(bands.passRateForScoreTime(situation)) - logit(bands.leagueAveragePassRate());
    var fieldZoneDelta =
        logit(bands.passRateForFieldZone(situation)) - logit(bands.leagueAveragePassRate());

    var clockBoost = 0.5 + normalize(tendencies.clockAwareness()) * 0.5;
    var blended =
        base + SCORE_TIME_WEIGHT * clockBoost * scoreTimeDelta + FIELD_ZONE_WEIGHT * fieldZoneDelta;

    var coachShift = normalize(tendencies.passHeaviness()) * PASS_RATE_MAX_LOGIT_SHIFT;
    return sigmoid(blended + coachShift);
  }

  /** Coach-adjusted weights for pass concepts. Renormalized so the returned map sums to ~1.0. */
  static Map<PassConcept, Double> passConceptWeights(
      Map<PassConcept, Double> baseline, CoachTendencies tendencies, Situation situation) {
    var weights = new EnumMap<PassConcept, Double>(PassConcept.class);
    for (var entry : baseline.entrySet()) {
      var w = entry.getValue();
      w *= conceptMultiplier(entry.getKey(), tendencies, situation);
      weights.put(entry.getKey(), w);
    }
    return normalize(weights);
  }

  /** Coach-adjusted run-concept weights. The {@code gapRunPreference} axis shifts zone vs gap. */
  static Map<RunConcept, Double> runConceptWeights(
      Map<RunConcept, Double> baseline, CoachTendencies tendencies) {
    var gapLean = normalize(tendencies.gapRunPreference());
    var zoneMul = boost(-gapLean);
    var gapMul = boost(gapLean);
    var weights = new EnumMap<RunConcept, Double>(RunConcept.class);
    for (var entry : baseline.entrySet()) {
      var concept = entry.getKey();
      var w = entry.getValue();
      w *=
          switch (concept) {
            case INSIDE_ZONE, OUTSIDE_ZONE -> zoneMul;
            case POWER, COUNTER, TRAP -> gapMul;
            default -> 1.0;
          };
      weights.put(concept, w);
    }
    return normalize(weights);
  }

  /** Coach-adjusted formation weights, biased by {@code shotgunPreference}. */
  static Map<OffensiveFormation, Double> formationWeights(
      Map<OffensiveFormation, Double> baseline, CoachTendencies tendencies) {
    var gunLean = normalize(tendencies.shotgunPreference());
    var weights = new EnumMap<OffensiveFormation, Double>(OffensiveFormation.class);
    for (var entry : baseline.entrySet()) {
      var f = entry.getKey();
      var w = entry.getValue();
      w *=
          switch (f) {
            case SHOTGUN, EMPTY -> boost(gunLean);
            case SINGLEBACK, I_FORM, PISTOL, JUMBO -> boost(-gunLean);
          };
      weights.put(f, w);
    }
    return normalize(weights);
  }

  private static double conceptMultiplier(
      PassConcept concept, CoachTendencies tendencies, Situation situation) {
    return switch (concept) {
      case PLAY_ACTION -> boost(normalize(tendencies.playActionAffinity()));
      case SCREEN -> boost(normalize(tendencies.screenAffinity()));
      case RPO -> boost(normalize(tendencies.rpoAffinity()));
      case HAIL_MARY -> hailMaryMultiplier(tendencies, situation);
      case QUICK_GAME, DROPBACK -> 1.0;
    };
  }

  private static double hailMaryMultiplier(CoachTendencies tendencies, Situation situation) {
    var late =
        situation.timeBucket() == Situation.TimeBucket.UNDER_5_MIN_Q4
            || situation.timeBucket() == Situation.TimeBucket.TWO_MIN_H1;
    if (!late) {
      return 0.0;
    }
    return boost(normalize(tendencies.riskTolerance()));
  }

  private static double boost(double delta) {
    if (delta >= 0) {
      return 1.0 + delta * (CONCEPT_MAX_MULTIPLIER - 1.0);
    }
    return 1.0 + delta * (1.0 - CONCEPT_MIN_MULTIPLIER);
  }

  private static <K> Map<K, Double> normalize(Map<K, Double> weights) {
    var total = weights.values().stream().mapToDouble(Double::doubleValue).sum();
    if (total <= 0) {
      return weights;
    }
    var out = new LinkedHashMap<K, Double>(weights.size());
    for (var entry : weights.entrySet()) {
      out.put(entry.getKey(), entry.getValue() / total);
    }
    return out;
  }

  private static double logit(double p) {
    var clamped = Math.max(1e-6, Math.min(1.0 - 1e-6, p));
    return Math.log(clamped / (1.0 - clamped));
  }

  private static double sigmoid(double x) {
    return 1.0 / (1.0 + Math.exp(-x));
  }
}
