package app.zoneblitz.gamesimulator.formation;

import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

/**
 * Band-backed {@link BoxCountSampler} reading {@code formation-box.json}. Formation×play-type
 * buckets with fewer than the calibration floor of plays in BDB are omitted from the JSON; the
 * sampler falls back first to the same formation's other play-type bucket (EMPTY-on-run ≈
 * EMPTY-on-pass is closer to truth than any SINGLEBACK bucket), and if that's also missing, to the
 * modal formation for the requested play type.
 */
public final class BandBoxCountSampler implements BoxCountSampler {

  private static final String RESOURCE = "formation-box.json";
  private static final OffensiveFormation RUN_FALLBACK = OffensiveFormation.SINGLEBACK;
  private static final OffensiveFormation PASS_FALLBACK = OffensiveFormation.SHOTGUN;

  private final Map<OffensiveFormation, Map<Integer, Double>> runWeights;
  private final Map<OffensiveFormation, Map<Integer, Double>> passWeights;

  public BandBoxCountSampler(
      Map<OffensiveFormation, Map<Integer, Double>> runWeights,
      Map<OffensiveFormation, Map<Integer, Double>> passWeights) {
    Objects.requireNonNull(runWeights, "runWeights");
    Objects.requireNonNull(passWeights, "passWeights");
    if (!runWeights.containsKey(RUN_FALLBACK)) {
      throw new IllegalArgumentException("runWeights missing fallback formation " + RUN_FALLBACK);
    }
    if (!passWeights.containsKey(PASS_FALLBACK)) {
      throw new IllegalArgumentException("passWeights missing fallback formation " + PASS_FALLBACK);
    }
    this.runWeights = Map.copyOf(runWeights);
    this.passWeights = Map.copyOf(passWeights);
  }

  /** Load a sampler from the default {@code formation-box.json} band resource. */
  public static BandBoxCountSampler load(BandRepository repo) {
    return new BandBoxCountSampler(
        loadSide(repo, "bands.run.by_formation"), loadSide(repo, "bands.pass.by_formation"));
  }

  private static Map<OffensiveFormation, Map<Integer, Double>> loadSide(
      BandRepository repo, String parentPath) {
    var out = new EnumMap<OffensiveFormation, Map<Integer, Double>>(OffensiveFormation.class);
    for (var form : OffensiveFormation.values()) {
      var leaf = parentPath + "." + form.name() + ".distribution";
      try {
        var weights = repo.loadWeights(RESOURCE, leaf, Integer.class);
        out.put(form, weights);
      } catch (IllegalArgumentException ignored) {
        // Formation under BDB sample threshold — handled by sample()'s fallback chain.
      }
    }
    return out;
  }

  @Override
  public int sample(OffensiveFormation formation, PlayType playType, RandomSource rng) {
    Objects.requireNonNull(formation, "formation");
    Objects.requireNonNull(playType, "playType");
    Objects.requireNonNull(rng, "rng");
    var weights = pick(formation, playType);
    return weightedSample(weights, rng.nextDouble());
  }

  private Map<Integer, Double> pick(OffensiveFormation formation, PlayType playType) {
    var primary = (playType == PlayType.RUN ? runWeights : passWeights).get(formation);
    if (primary != null) {
      return primary;
    }
    var other = (playType == PlayType.RUN ? passWeights : runWeights).get(formation);
    if (other != null) {
      return other;
    }
    var fallbackForm = playType == PlayType.RUN ? RUN_FALLBACK : PASS_FALLBACK;
    return (playType == PlayType.RUN ? runWeights : passWeights).get(fallbackForm);
  }

  static int weightedSample(Map<Integer, Double> weights, double u) {
    var total = 0.0;
    for (var w : weights.values()) {
      total += w;
    }
    var threshold = u * total;
    var running = 0.0;
    Integer last = null;
    for (var entry : weights.entrySet()) {
      running += entry.getValue();
      last = entry.getKey();
      if (running >= threshold) {
        return entry.getKey();
      }
    }
    return last;
  }
}
