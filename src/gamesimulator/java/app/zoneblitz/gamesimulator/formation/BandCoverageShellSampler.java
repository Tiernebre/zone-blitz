package app.zoneblitz.gamesimulator.formation;

import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.Collections;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Band-backed {@link CoverageShellSampler} reading {@code coverage-shell.json}. Formations below
 * the BDB sample threshold (JUMBO in the current data) fall back to the overall pooled shell
 * distribution.
 *
 * <p>The personnel-aware overload multiplicatively shifts the formation's shell weights based on
 * the offense's receiver-room vertical-threat profile. The shift averages WR + TE {@code speed}
 * (physical) and {@code routeRunning} (skill); 50 is the league-average pivot, and the {@code [0,
 * 100]} range maps to a normalized {@code [-1, 1]} delta. A positive delta scales two-high shells
 * up and single-high shells down, and vice versa, capped by {@link #PERSONNEL_MAX_MULTIPLIER}.
 *
 * <p>Magnitude is intentionally conservative: at saturation a fast WR room moves the two-high share
 * by roughly 5-7 percentage points, which is the BDB tracking gap between vertical-threat and
 * possession-receiver identities at fixed formation. Calibration tests with uniform average
 * attributes reproduce the personnel-blind distribution.
 */
public final class BandCoverageShellSampler implements CoverageShellSampler {

  private static final String RESOURCE = "coverage-shell.json";

  private static final double PERSONNEL_MAX_MULTIPLIER = 1.25;
  private static final double PERSONNEL_MIN_MULTIPLIER = 1.0 / PERSONNEL_MAX_MULTIPLIER;

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
  public CoverageShell sample(
      OffensiveFormation formation, OffensivePersonnel personnel, RandomSource rng) {
    Objects.requireNonNull(formation, "formation");
    Objects.requireNonNull(personnel, "personnel");
    Objects.requireNonNull(rng, "rng");
    var weights = byFormation.getOrDefault(formation, fallback);
    var shifted = shiftForPersonnel(weights, personnel);
    return weightedSample(shifted, rng.nextDouble());
  }

  static Map<CoverageShell, Double> shiftForPersonnel(
      Map<CoverageShell, Double> weights, OffensivePersonnel personnel) {
    var delta = verticalThreatDelta(personnel);
    if (delta == 0.0) {
      return weights;
    }
    var twoHighMultiplier = boost(delta);
    var singleHighMultiplier = boost(-delta);
    var shifted = new LinkedHashMap<CoverageShell, Double>(weights.size());
    for (var entry : weights.entrySet()) {
      var shell = entry.getKey();
      var w = entry.getValue();
      if (isTwoHigh(shell)) {
        w *= twoHighMultiplier;
      } else if (isSingleHigh(shell)) {
        w *= singleHighMultiplier;
      }
      shifted.put(shell, w);
    }
    return shifted;
  }

  private static double verticalThreatDelta(OffensivePersonnel personnel) {
    var receivers = personnel.receivers();
    var tightEnds = personnel.tightEnds();
    if (receivers.isEmpty() && tightEnds.isEmpty()) {
      return 0.0;
    }
    var combined = combine(receivers, tightEnds);
    var avgSpeed = averageSpeed(combined);
    var avgRoute = averageRouteRunning(combined);
    var raw = (avgSpeed + avgRoute) / 2.0;
    return Math.max(-1.0, Math.min(1.0, (raw - 50.0) / 50.0));
  }

  private static List<Player> combine(List<Player> a, List<Player> b) {
    var out = new java.util.ArrayList<Player>(a.size() + b.size());
    out.addAll(a);
    out.addAll(b);
    return out;
  }

  private static double averageSpeed(List<Player> players) {
    var sum = 0.0;
    for (var p : players) {
      sum += p.physical().speed();
    }
    return sum / players.size();
  }

  private static double averageRouteRunning(List<Player> players) {
    var sum = 0.0;
    for (var p : players) {
      sum += p.skill().routeRunning();
    }
    return sum / players.size();
  }

  private static boolean isTwoHigh(CoverageShell shell) {
    return switch (shell) {
      case COVER_2, QUARTERS, COVER_6, TWO_MAN -> true;
      default -> false;
    };
  }

  private static boolean isSingleHigh(CoverageShell shell) {
    return switch (shell) {
      case COVER_0, COVER_1, COVER_3 -> true;
      default -> false;
    };
  }

  private static double boost(double delta) {
    if (delta >= 0) {
      return 1.0 + delta * (PERSONNEL_MAX_MULTIPLIER - 1.0);
    }
    return 1.0 + delta * (1.0 - PERSONNEL_MIN_MULTIPLIER);
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
