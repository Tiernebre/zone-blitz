package app.zoneblitz.gamesimulator.adjustments;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.roster.CoachTendencies;
import java.util.EnumMap;

/**
 * Stats-based {@link OffensiveAdjustmentSource}. Reads the offense's <em>own</em> log as a proxy
 * for what the defense is doing: high sack rate ⇒ defense is blitzing ⇒ pivot to screens / quick
 * game / shotgun; high stuff rate ⇒ box is loaded ⇒ pivot to play-action. Returns {@link
 * OffensiveAdjustments#NEUTRAL} below a sample-size floor.
 */
public final class StatsBasedOffensiveAdjustments implements OffensiveAdjustmentSource {

  static final int MIN_DROPBACK_SAMPLE = 6;
  static final int MIN_RUSH_SAMPLE = 6;

  static final double BLITZED_SACK_RATE = 0.10;
  static final double STUFFED_RATE = 0.30;

  static final double BLITZED_PASS_RATE_LOGIT_SHIFT = -0.2;
  static final double BLITZED_SHOTGUN_LOGIT_SHIFT = 0.4;
  static final double STUFFED_PASS_RATE_LOGIT_SHIFT = 0.15;

  static final double BLITZED_SCREEN_MULT = 1.6;
  static final double BLITZED_QUICK_GAME_MULT = 1.3;
  static final double BLITZED_HAIL_MARY_MULT = 0.7;

  static final double STUFFED_PLAY_ACTION_MULT = 1.4;
  static final double STUFFED_INSIDE_ZONE_MULT = 0.85;

  @Override
  public OffensiveAdjustments compute(TeamPlayLog ownOffenseLog, CoachTendencies oc) {
    java.util.Objects.requireNonNull(ownOffenseLog, "ownOffenseLog");
    java.util.Objects.requireNonNull(oc, "oc");

    var dropbacks = ownOffenseLog.passAttempts() + ownOffenseLog.sacks();
    var dropbackSample = dropbacks >= MIN_DROPBACK_SAMPLE;
    var rushSample = ownOffenseLog.rushAttempts() >= MIN_RUSH_SAMPLE;

    if (!dropbackSample && !rushSample) {
      return OffensiveAdjustments.NEUTRAL;
    }

    var passRateShift = 0.0;
    var shotgunShift = 0.0;
    var passConceptMults = new EnumMap<PassConcept, Double>(PassConcept.class);
    var runConceptMults = new EnumMap<RunConcept, Double>(RunConcept.class);

    if (dropbackSample) {
      var sackRate = (double) ownOffenseLog.sacks() / dropbacks;
      if (sackRate > BLITZED_SACK_RATE) {
        passRateShift += BLITZED_PASS_RATE_LOGIT_SHIFT;
        shotgunShift += BLITZED_SHOTGUN_LOGIT_SHIFT;
        passConceptMults.put(PassConcept.SCREEN, BLITZED_SCREEN_MULT);
        passConceptMults.put(PassConcept.QUICK_GAME, BLITZED_QUICK_GAME_MULT);
        passConceptMults.put(PassConcept.HAIL_MARY, BLITZED_HAIL_MARY_MULT);
      }
    }

    if (rushSample) {
      var stuffRate = (double) ownOffenseLog.stuffs() / ownOffenseLog.rushAttempts();
      if (stuffRate > STUFFED_RATE) {
        passRateShift += STUFFED_PASS_RATE_LOGIT_SHIFT;
        passConceptMults.merge(PassConcept.PLAY_ACTION, STUFFED_PLAY_ACTION_MULT, (a, b) -> a * b);
        runConceptMults.put(RunConcept.INSIDE_ZONE, STUFFED_INSIDE_ZONE_MULT);
      }
    }

    var gate = AdaptabilityGate.factor(oc.inGameAdaptability());
    if (gate >= 1.0
        && passRateShift == 0.0
        && shotgunShift == 0.0
        && passConceptMults.isEmpty()
        && runConceptMults.isEmpty()) {
      return OffensiveAdjustments.NEUTRAL;
    }
    var gatedPassConcepts = new EnumMap<PassConcept, Double>(PassConcept.class);
    for (var entry : passConceptMults.entrySet()) {
      gatedPassConcepts.put(
          entry.getKey(), AdaptabilityGate.scaleMultiplier(entry.getValue(), gate));
    }
    var gatedRunConcepts = new EnumMap<RunConcept, Double>(RunConcept.class);
    for (var entry : runConceptMults.entrySet()) {
      gatedRunConcepts.put(
          entry.getKey(), AdaptabilityGate.scaleMultiplier(entry.getValue(), gate));
    }
    return new OffensiveAdjustments(
        passRateShift * gate, gatedPassConcepts, gatedRunConcepts, shotgunShift * gate);
  }
}
