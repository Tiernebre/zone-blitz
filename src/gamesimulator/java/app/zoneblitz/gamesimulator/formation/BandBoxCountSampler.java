package app.zoneblitz.gamesimulator.formation;

import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Band-backed {@link BoxCountSampler} reading {@code formation-box.json}. Formation×play-type
 * buckets with fewer than the calibration floor of plays in BDB are omitted from the JSON; the
 * sampler falls back first to the same formation's other play-type bucket (EMPTY-on-run ≈
 * EMPTY-on-pass is closer to truth than any SINGLEBACK bucket), and if that's also missing, to the
 * modal formation for the requested play type.
 *
 * <p>The personnel-aware overloads multiplicatively shift the formation×play-type weights based on
 * the offense's run-threat strength. The shift averages OL {@code strength}, {@code power}, and
 * {@code runBlock} (skill axis); 50 is the league-average pivot, and the {@code [0, 100]} range
 * maps to a normalized {@code [-1, 1]} delta. A positive delta scales heavy-box weights up and
 * light-box weights down (and vice versa); the maximum multiplier at saturation is bounded by
 * {@link #PERSONNEL_MAX_MULTIPLIER} to keep the shift small relative to formation priors.
 *
 * <p>Magnitude is intentionally conservative: at saturation a heavy-OL roster moves the mean box by
 * roughly half a defender on RUN downs, which lines up with the BDB tracking gap between
 * ground-and-pound vs. spread-pass identities at fixed formation. Calibration tests with uniform
 * average attributes reproduce the personnel-blind distribution.
 */
public final class BandBoxCountSampler implements BoxCountSampler {

  private static final String RESOURCE = "formation-box.json";
  private static final OffensiveFormation RUN_FALLBACK = OffensiveFormation.SINGLEBACK;
  private static final OffensiveFormation PASS_FALLBACK = OffensiveFormation.SHOTGUN;

  private static final double PERSONNEL_MAX_MULTIPLIER = 1.35;
  private static final double PERSONNEL_MIN_MULTIPLIER = 1.0 / PERSONNEL_MAX_MULTIPLIER;
  private static final int HEAVY_BOX_THRESHOLD = 7;

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

  @Override
  public double expectedBox(OffensiveFormation formation, PlayType playType) {
    Objects.requireNonNull(formation, "formation");
    Objects.requireNonNull(playType, "playType");
    var weights = pick(formation, playType);
    return mean(weights);
  }

  @Override
  public int sample(
      OffensiveFormation formation,
      PlayType playType,
      OffensivePersonnel personnel,
      RandomSource rng) {
    Objects.requireNonNull(formation, "formation");
    Objects.requireNonNull(playType, "playType");
    Objects.requireNonNull(personnel, "personnel");
    Objects.requireNonNull(rng, "rng");
    var weights = shiftForPersonnel(pick(formation, playType), personnel);
    return weightedSample(weights, rng.nextDouble());
  }

  @Override
  public double expectedBox(
      OffensiveFormation formation, PlayType playType, OffensivePersonnel personnel) {
    Objects.requireNonNull(formation, "formation");
    Objects.requireNonNull(playType, "playType");
    Objects.requireNonNull(personnel, "personnel");
    var weights = shiftForPersonnel(pick(formation, playType), personnel);
    return mean(weights);
  }

  private static Map<Integer, Double> shiftForPersonnel(
      Map<Integer, Double> weights, OffensivePersonnel personnel) {
    var delta = runThreatDelta(personnel);
    if (delta == 0.0) {
      return weights;
    }
    var heavyMultiplier = boost(delta);
    var lightMultiplier = boost(-delta);
    var shifted = new LinkedHashMap<Integer, Double>(weights.size());
    for (var entry : weights.entrySet()) {
      var box = entry.getKey();
      var w = entry.getValue();
      var multiplier = box >= HEAVY_BOX_THRESHOLD ? heavyMultiplier : lightMultiplier;
      shifted.put(box, w * multiplier);
    }
    return shifted;
  }

  private static double runThreatDelta(OffensivePersonnel personnel) {
    var ol = personnel.offensiveLine();
    if (ol.isEmpty()) {
      return 0.0;
    }
    var avgStrength = averagePhysical(ol, true);
    var avgRunBlock = averageRunBlock(ol);
    var raw = (avgStrength + avgRunBlock) / 2.0;
    return Math.max(-1.0, Math.min(1.0, (raw - 50.0) / 50.0));
  }

  private static double averagePhysical(List<Player> players, boolean strengthAndPower) {
    var sum = 0.0;
    for (var p : players) {
      sum +=
          strengthAndPower
              ? (p.physical().strength() + p.physical().power()) / 2.0
              : p.physical().speed();
    }
    return sum / players.size();
  }

  private static double averageRunBlock(List<Player> players) {
    var sum = 0.0;
    for (var p : players) {
      sum += p.skill().runBlock();
    }
    return sum / players.size();
  }

  private static double boost(double delta) {
    if (delta >= 0) {
      return 1.0 + delta * (PERSONNEL_MAX_MULTIPLIER - 1.0);
    }
    return 1.0 + delta * (1.0 - PERSONNEL_MIN_MULTIPLIER);
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

  private static double mean(Map<Integer, Double> weights) {
    var total = 0.0;
    var weightedSum = 0.0;
    for (var entry : weights.entrySet()) {
      total += entry.getValue();
      weightedSum += entry.getKey() * entry.getValue();
    }
    return weightedSum / total;
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
