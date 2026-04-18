package app.zoneblitz.gamesimulator.playcalling;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.CoachTendencies;
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

  public TendencyPlayCaller(PlayCallBands bands) {
    this.bands = Objects.requireNonNull(bands, "bands");
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

    var passRate = TendencyShifts.blendedPassRate(bands, situation, tendencies);
    var isPass = rng.nextDouble() < passRate;

    if (isPass) {
      var concept = pickPassConcept(situation, tendencies, rng);
      var formation = pickFormation(bands.passFormationBaseline(), tendencies, rng);
      return new PlayCall("pass", RunConcept.INSIDE_ZONE, concept, formation);
    }
    var concept = pickRunConcept(tendencies, rng);
    var formation = pickFormation(bands.runFormationBaseline(), tendencies, rng);
    return new PlayCall("run", concept, PassConcept.DROPBACK, formation);
  }

  private PassConcept pickPassConcept(
      Situation situation, CoachTendencies tendencies, RandomSource rng) {
    var weights =
        TendencyShifts.passConceptWeights(bands.passConceptBaseline(), tendencies, situation);
    return sample(weights, rng, PassConcept.DROPBACK);
  }

  private RunConcept pickRunConcept(CoachTendencies tendencies, RandomSource rng) {
    var weights = TendencyShifts.runConceptWeights(bands.runConceptBaseline(), tendencies);
    return sample(weights, rng, RunConcept.INSIDE_ZONE);
  }

  private OffensiveFormation pickFormation(
      Map<OffensiveFormation, Double> baseline, CoachTendencies tendencies, RandomSource rng) {
    var weights = TendencyShifts.formationWeights(baseline, tendencies);
    return sample(weights, rng, OffensiveFormation.SHOTGUN);
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
