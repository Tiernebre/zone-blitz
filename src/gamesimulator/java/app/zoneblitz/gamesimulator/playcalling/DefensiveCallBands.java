package app.zoneblitz.gamesimulator.playcalling;

import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.formation.CoverageShell;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import java.util.Collections;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * League-average priors used by {@link BaselineDefensiveCallSelector}. Shell + man/zone weights
 * come from {@code coverage-shell.json} (BDB 2021 pass plays, PFF-labelled); blitz-rate and
 * personnel-package baselines are hand-tuned from public NGS summaries — plug in a sourced band
 * file as it lands.
 */
final class DefensiveCallBands {

  private static final String COVERAGE_SHELL = "coverage-shell.json";

  /** Baseline rate of 5+ rushers (i.e. {@code extraRushers >= 1}) on dropbacks. */
  static final double BASELINE_BLITZ_RATE = 0.30;

  /** Distribution of {@code extraRushers} given that a blitz is called. Keys 1..3. */
  // Map.of would JVM-salt iteration order; this map is iterated in a cumulative weighted draw.
  static final Map<Integer, Double> BLITZ_COUNT_WEIGHTS = blitzCountWeights();

  private static Map<Integer, Double> blitzCountWeights() {
    var m = new LinkedHashMap<Integer, Double>();
    m.put(1, 0.60);
    m.put(2, 0.30);
    m.put(3, 0.10);
    return Collections.unmodifiableMap(m);
  }

  private final Map<OffensiveFormation, Map<CoverageShell, Double>> shellByFormation;
  private final Map<OffensiveFormation, Double> manRateByFormation;
  private final Map<CoverageShell, Double> overallShell;
  private final double overallManRate;

  private DefensiveCallBands(
      Map<OffensiveFormation, Map<CoverageShell, Double>> shellByFormation,
      Map<OffensiveFormation, Double> manRateByFormation,
      Map<CoverageShell, Double> overallShell,
      double overallManRate) {
    this.shellByFormation = shellByFormation;
    this.manRateByFormation = manRateByFormation;
    this.overallShell = overallShell;
    this.overallManRate = overallManRate;
  }

  static DefensiveCallBands load(BandRepository repo) {
    var overallShell = repo.loadWeights(COVERAGE_SHELL, "bands.overall.shell", CoverageShell.class);
    var overallManRate = repo.loadScalar(COVERAGE_SHELL, "bands.overall.type.man");

    var shellByFormation =
        new EnumMap<OffensiveFormation, Map<CoverageShell, Double>>(OffensiveFormation.class);
    var manByFormation = new EnumMap<OffensiveFormation, Double>(OffensiveFormation.class);
    for (var formation : OffensiveFormation.values()) {
      try {
        var shell =
            repo.loadWeights(
                COVERAGE_SHELL,
                "bands.by_formation." + formation.name() + ".shell",
                CoverageShell.class);
        shellByFormation.put(formation, Collections.unmodifiableMap(new LinkedHashMap<>(shell)));
        var man =
            repo.loadScalar(COVERAGE_SHELL, "bands.by_formation." + formation.name() + ".type.man");
        manByFormation.put(formation, man);
      } catch (IllegalArgumentException ignored) {
        // Formation below the sampling threshold in the band file; fall back to overall.
      }
    }
    return new DefensiveCallBands(
        shellByFormation,
        manByFormation,
        Collections.unmodifiableMap(new LinkedHashMap<>(overallShell)),
        overallManRate);
  }

  Map<CoverageShell, Double> shellBaseline(OffensiveFormation formation) {
    return shellByFormation.getOrDefault(formation, overallShell);
  }

  double manRateBaseline(OffensiveFormation formation) {
    return manRateByFormation.getOrDefault(formation, overallManRate);
  }
}
