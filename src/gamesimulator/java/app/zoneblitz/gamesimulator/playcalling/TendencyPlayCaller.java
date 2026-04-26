package app.zoneblitz.gamesimulator.playcalling;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.adjustments.OffensiveAdjustmentSource;
import app.zoneblitz.gamesimulator.adjustments.OffensiveAdjustments;
import app.zoneblitz.gamesimulator.adjustments.StatsBasedOffensiveAdjustments;
import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachTendencies;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Play caller that blends league-average situational priors ({@code play-call-tendencies.json})
 * with the offensive coach's {@link CoachTendencies} to pick pass/run, formation, and concept.
 * Situational priors dominate — a pass-happy coach on 3rd-and-1 still predominantly runs — and with
 * a {@link CoachTendencies#average()} coach the caller reproduces the distributions shipped in the
 * bands.
 */
public final class TendencyPlayCaller implements PlayCaller {

  private final PlayCallBands bands;
  private final OffensiveAdjustmentSource adjustments;

  public TendencyPlayCaller(PlayCallBands bands) {
    this(bands, new StatsBasedOffensiveAdjustments());
  }

  public TendencyPlayCaller(PlayCallBands bands, OffensiveAdjustmentSource adjustments) {
    this.bands = Objects.requireNonNull(bands, "bands");
    this.adjustments = Objects.requireNonNull(adjustments, "adjustments");
  }

  /** Load the default caller from the classpath-backed band repository. */
  public static TendencyPlayCaller load(BandRepository repo) {
    return new TendencyPlayCaller(PlayCallBands.load(repo));
  }

  @Override
  public PlayCall call(GameState state, Coach offensiveCoach, RandomSource rng) {
    Objects.requireNonNull(state, "state");
    Objects.requireNonNull(offensiveCoach, "offensiveCoach");
    Objects.requireNonNull(rng, "rng");

    var tendencies = offensiveCoach.offense();
    var situation = Situation.from(state);
    var bundle = adjustments.compute(state.stats().forOffense(state.possession()), tendencies);

    var basePassRate = TendencyShifts.blendedPassRate(bands, situation, tendencies);
    var passRate = applyLogitShift(basePassRate, bundle.passRateLogitShift());
    var isPass = rng.nextDouble() < passRate;

    if (isPass) {
      var concept = pickPassConcept(situation, tendencies, bundle, rng);
      var formation =
          pickFormation(bands.passFormationBaseline(), tendencies, bundle.shotgunLogitShift(), rng);
      return new PlayCall("pass", RunConcept.INSIDE_ZONE, concept, formation);
    }
    var concept = pickRunConcept(tendencies, bundle, rng);
    var formation =
        pickFormation(bands.runFormationBaseline(), tendencies, bundle.shotgunLogitShift(), rng);
    return new PlayCall("run", concept, PassConcept.DROPBACK, formation);
  }

  private PassConcept pickPassConcept(
      Situation situation,
      CoachTendencies tendencies,
      OffensiveAdjustments bundle,
      RandomSource rng) {
    var coachWeights =
        TendencyShifts.passConceptWeights(bands.passConceptBaseline(), tendencies, situation);
    var adjusted = new EnumMap<PassConcept, Double>(PassConcept.class);
    for (var entry : coachWeights.entrySet()) {
      adjusted.put(entry.getKey(), entry.getValue() * bundle.passConceptMultiplier(entry.getKey()));
    }
    return sample(adjusted, rng, PassConcept.DROPBACK);
  }

  private RunConcept pickRunConcept(
      CoachTendencies tendencies, OffensiveAdjustments bundle, RandomSource rng) {
    var coachWeights = TendencyShifts.runConceptWeights(bands.runConceptBaseline(), tendencies);
    var adjusted = new EnumMap<RunConcept, Double>(RunConcept.class);
    for (var entry : coachWeights.entrySet()) {
      adjusted.put(entry.getKey(), entry.getValue() * bundle.runConceptMultiplier(entry.getKey()));
    }
    return sample(adjusted, rng, RunConcept.INSIDE_ZONE);
  }

  private OffensiveFormation pickFormation(
      Map<OffensiveFormation, Double> baseline,
      CoachTendencies tendencies,
      double shotgunShift,
      RandomSource rng) {
    var coachWeights = TendencyShifts.formationWeights(baseline, tendencies);
    if (shotgunShift == 0.0) {
      return sample(coachWeights, rng, OffensiveFormation.SHOTGUN);
    }
    var shifted = new LinkedHashMap<OffensiveFormation, Double>(coachWeights.size());
    for (var entry : coachWeights.entrySet()) {
      shifted.put(
          entry.getKey(), entry.getValue() * shotgunMultiplier(entry.getKey(), shotgunShift));
    }
    return sample(shifted, rng, OffensiveFormation.SHOTGUN);
  }

  private static double shotgunMultiplier(OffensiveFormation formation, double shift) {
    return switch (formation) {
      case SHOTGUN, EMPTY -> Math.exp(shift);
      case SINGLEBACK, I_FORM, PISTOL, JUMBO -> Math.exp(-shift);
    };
  }

  private static double applyLogitShift(double probability, double logitShift) {
    if (logitShift == 0.0) {
      return probability;
    }
    var clamped = Math.max(1e-6, Math.min(1.0 - 1e-6, probability));
    var logit = Math.log(clamped / (1.0 - clamped));
    var shifted = logit + logitShift;
    return 1.0 / (1.0 + Math.exp(-shifted));
  }

  private static <K> K sample(Map<K, Double> weights, RandomSource rng, K fallback) {
    var total = weights.values().stream().mapToDouble(Double::doubleValue).sum();
    if (total <= 0) {
      return fallback;
    }
    var target = rng.nextDouble() * total;
    var cumulative = 0.0;
    K last = fallback;
    for (var entry : weights.entrySet()) {
      cumulative += entry.getValue();
      last = entry.getKey();
      if (target <= cumulative) {
        return last;
      }
    }
    return last;
  }
}
