package app.zoneblitz.gamesimulator.formation;

import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.Collections;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Band-backed {@link CoverageShellSampler} reading {@code coverage-shell.json}. Formations below
 * the BDB sample threshold (JUMBO in the current data) fall back to the overall pooled shell
 * distribution.
 */
public final class BandCoverageShellSampler implements CoverageShellSampler {

  private static final String RESOURCE = "coverage-shell.json";

  private final Map<OffensiveFormation, Map<CoverageShell, Double>> byFormation;
  private final Map<CoverageShell, Double> fallback;

  public BandCoverageShellSampler(
      Map<OffensiveFormation, Map<CoverageShell, Double>> byFormation,
      Map<CoverageShell, Double> fallback) {
    Objects.requireNonNull(byFormation, "byFormation");
    Objects.requireNonNull(fallback, "fallback");
    if (fallback.isEmpty()) {
      throw new IllegalArgumentException("fallback shell weights must be non-empty");
    }
    this.byFormation = Map.copyOf(byFormation);
    // fallback is iterated in weightedSample; Map.copyOf would JVM-salt iteration order.
    this.fallback = Collections.unmodifiableMap(new LinkedHashMap<>(fallback));
  }

  /** Load a sampler from the default {@code coverage-shell.json} band resource. */
  public static BandCoverageShellSampler load(BandRepository repo) {
    var overall = repo.loadWeights(RESOURCE, "bands.overall.shell", CoverageShell.class);
    var byFormation =
        new EnumMap<OffensiveFormation, Map<CoverageShell, Double>>(OffensiveFormation.class);
    for (var form : OffensiveFormation.values()) {
      var leaf = "bands.by_formation." + form.name() + ".shell";
      try {
        byFormation.put(form, repo.loadWeights(RESOURCE, leaf, CoverageShell.class));
      } catch (IllegalArgumentException ignored) {
        // Formation under BDB sample threshold — fall back to overall at sample time.
      }
    }
    return new BandCoverageShellSampler(byFormation, overall);
  }

  @Override
  public CoverageShell sample(OffensiveFormation formation, RandomSource rng) {
    Objects.requireNonNull(formation, "formation");
    Objects.requireNonNull(rng, "rng");
    var weights = byFormation.getOrDefault(formation, fallback);
    return weightedSample(weights, rng.nextDouble());
  }

  static CoverageShell weightedSample(Map<CoverageShell, Double> weights, double u) {
    var total = 0.0;
    for (var w : weights.values()) {
      total += w;
    }
    var threshold = u * total;
    var running = 0.0;
    CoverageShell last = null;
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
