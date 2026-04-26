package app.zoneblitz.gamesimulator.adjustments;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.roster.DefensiveCoachTendencies;
import java.util.EnumMap;
import java.util.Map;

/**
 * Stats-based {@link DefensiveAdjustmentSource}. Threshold-style derivations against the offense's
 * recent efficiency: hot run game pulls defenders into the box, hot pass game pushes coverage into
 * two-high, screen-heavy stretches dampen the screen multiplier so the defense implicitly counters
 * the call. Returns {@link DefensiveAdjustments#NEUTRAL} below a sample-size floor.
 *
 * <p>Phase 8 calibration will tune the constants against nflfastR drive-level distributions; the
 * shape is documented in the plan and held stable so calibration is purely a numeric edit.
 */
public final class StatsBasedDefensiveAdjustments implements DefensiveAdjustmentSource {

  static final int MIN_PASS_SAMPLE = 6;
  static final int MIN_RUSH_SAMPLE = 6;
  static final int MIN_RECENT_FOR_CONCEPT_COUNTER = 6;

  // Thresholds anchored to 2022-24 nflfastR rolling-5-attempt distributions:
  //   YPC p70 ≈ 5.2  →  HOT_YPC_THRESHOLD
  //   YPA p70 ≈ 8.6  →  HOT_YPA_THRESHOLD
  //   Drive explosive rate p70-p75 ≈ 0.14-0.17 → HIGH_EXPLOSIVE_RATE
  // Crossing the threshold means the offense is hotter than ~70% of in-game
  // 5-play windows — a credible "they've found something" signal without
  // firing on routine variance.
  static final double HOT_YPC_THRESHOLD = 5.2;
  static final double HOT_YPA_THRESHOLD = 8.5;
  static final double HIGH_EXPLOSIVE_RATE = 0.16;
  static final double HOT_SCREEN_SHARE = 0.30;

  static final double RUN_HUMMING_BLITZ_SHIFT = 0.4;
  static final double PASS_HUMMING_BLITZ_SHIFT = 0.5;
  static final double EXPLOSIVE_BLITZ_DAMPEN = -0.3;

  static final double PASS_HUMMING_TWO_HIGH_MULT = 0.7;
  static final double EXPLOSIVE_TWO_HIGH_MULT = 0.65;
  static final double RUN_HUMMING_SINGLE_HIGH_MULT = 1.25;

  static final double RUN_HUMMING_BOX_LOADING = 0.4;

  static final double PASS_HUMMING_MAN_SHIFT = -0.2;
  static final double RUN_HUMMING_MAN_SHIFT = 0.15;

  static final double SCREEN_COUNTER_MULT = 0.6;

  @Override
  public DefensiveAdjustments compute(TeamPlayLog opponentOffenseLog, DefensiveCoachTendencies dc) {
    java.util.Objects.requireNonNull(opponentOffenseLog, "opponentOffenseLog");
    java.util.Objects.requireNonNull(dc, "dc");

    var passSample = opponentOffenseLog.passAttempts() >= MIN_PASS_SAMPLE;
    var rushSample = opponentOffenseLog.rushAttempts() >= MIN_RUSH_SAMPLE;
    var recentSample = opponentOffenseLog.recentPlays().size() >= MIN_RECENT_FOR_CONCEPT_COUNTER;

    if (!passSample && !rushSample && !recentSample) {
      return DefensiveAdjustments.NEUTRAL;
    }

    var blitz = 0.0;
    var manShift = 0.0;
    var singleHighMult = 1.0;
    var boxLoading = 0.0;
    var conceptMultipliers = new EnumMap<PassConcept, Double>(PassConcept.class);

    if (rushSample && opponentOffenseLog.yardsPerCarry() > HOT_YPC_THRESHOLD) {
      blitz += RUN_HUMMING_BLITZ_SHIFT;
      singleHighMult *= RUN_HUMMING_SINGLE_HIGH_MULT;
      boxLoading += RUN_HUMMING_BOX_LOADING;
      manShift += RUN_HUMMING_MAN_SHIFT;
    }

    if (passSample && opponentOffenseLog.yardsPerAttempt() > HOT_YPA_THRESHOLD) {
      blitz += PASS_HUMMING_BLITZ_SHIFT;
      singleHighMult *= PASS_HUMMING_TWO_HIGH_MULT;
      manShift += PASS_HUMMING_MAN_SHIFT;
    }

    if ((passSample || rushSample) && opponentOffenseLog.explosiveRate() > HIGH_EXPLOSIVE_RATE) {
      blitz += EXPLOSIVE_BLITZ_DAMPEN;
      singleHighMult *= EXPLOSIVE_TWO_HIGH_MULT;
    }

    if (recentSample && opponentOffenseLog.recentScreenShare() > HOT_SCREEN_SHARE) {
      conceptMultipliers.put(PassConcept.SCREEN, SCREEN_COUNTER_MULT);
    }

    var gate = AdaptabilityGate.factor(dc.inGameAdaptability());
    return gateAdjustments(blitz, manShift, singleHighMult, boxLoading, conceptMultipliers, gate);
  }

  private static DefensiveAdjustments gateAdjustments(
      double blitz,
      double manShift,
      double singleHighMult,
      double boxLoading,
      Map<PassConcept, Double> conceptMultipliers,
      double gate) {
    if (gate >= 1.0
        && conceptMultipliers.isEmpty()
        && blitz == 0.0
        && manShift == 0.0
        && boxLoading == 0.0
        && singleHighMult == 1.0) {
      return DefensiveAdjustments.NEUTRAL;
    }
    var gatedConcepts = new EnumMap<PassConcept, Double>(PassConcept.class);
    for (var entry : conceptMultipliers.entrySet()) {
      gatedConcepts.put(entry.getKey(), AdaptabilityGate.scaleMultiplier(entry.getValue(), gate));
    }
    return new DefensiveAdjustments(
        blitz * gate,
        manShift * gate,
        AdaptabilityGate.scaleMultiplier(singleHighMult, gate),
        boxLoading * gate,
        gatedConcepts);
  }
}
