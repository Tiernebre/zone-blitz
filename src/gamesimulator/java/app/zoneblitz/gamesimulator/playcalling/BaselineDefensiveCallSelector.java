package app.zoneblitz.gamesimulator.playcalling;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.adjustments.DefensiveAdjustmentSource;
import app.zoneblitz.gamesimulator.adjustments.DefensiveAdjustments;
import app.zoneblitz.gamesimulator.adjustments.StatsBasedDefensiveAdjustments;
import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.formation.CoverageShell;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.DefensiveCoachTendencies;
import app.zoneblitz.gamesimulator.roster.RosterProfile;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Samples a {@link DefensiveCall} from league-average priors (shell + man/zone from {@code
 * coverage-shell.json}, blitz-rate and personnel-package baselines in-code) nudged by the DC's
 * {@link DefensiveCoachTendencies}. Situational priors (3rd-and-long ⇒ more blitz, goal-line ⇒
 * BASE/GOAL_LINE) dominate; tendencies are bounded nudges.
 *
 * <p>Neutral DC + neutral situation reproduces the shipped priors. Axes exposed today:
 *
 * <ul>
 *   <li>{@code blitzFrequency} — logit shift on the 5+ rusher rate.
 *   <li>{@code manZoneBias} — logit shift on man-coverage share.
 *   <li>{@code coverageShellBias} — single-high (Cover-1, Cover-3, Cover-0) vs two-high (Cover-2,
 *       Quarters, Cover-6, Two-Man) weight boost.
 *   <li>{@code substitutionAggression} — shifts BASE → NICKEL on early downs.
 * </ul>
 */
public final class BaselineDefensiveCallSelector implements DefensiveCallSelector {

  private static final double BLITZ_MAX_LOGIT_SHIFT = 0.7;
  private static final double MAN_MAX_LOGIT_SHIFT = 0.6;
  private static final double SHELL_MAX_MULTIPLIER = 1.6;

  /**
   * Logit shift per unit of {@link RosterProfile#pressureLean()}. Conservative — at saturation a
   * stacked DL room moves the blitz logit by 0.20, roughly a 5-percentage-point swing on the
   * baseline blitz rate. Coach tendencies and situational priors still dominate.
   */
  static final double ROSTER_PRESSURE_LEAN_SCALE = 0.20;

  private final DefensiveCallBands bands;
  private final DefensiveAdjustmentSource adjustments;

  public BaselineDefensiveCallSelector(DefensiveCallBands bands) {
    this(bands, new StatsBasedDefensiveAdjustments());
  }

  public BaselineDefensiveCallSelector(
      DefensiveCallBands bands, DefensiveAdjustmentSource adjustments) {
    this.bands = Objects.requireNonNull(bands, "bands");
    this.adjustments = Objects.requireNonNull(adjustments, "adjustments");
  }

  public static BaselineDefensiveCallSelector load(BandRepository repo) {
    return new BaselineDefensiveCallSelector(DefensiveCallBands.load(repo));
  }

  @Override
  public DefensiveCall select(
      GameState state,
      OffensiveFormation offenseFormation,
      DefensiveCoachTendencies dc,
      RosterProfile defenseProfile,
      RandomSource rng) {
    Objects.requireNonNull(state, "state");
    Objects.requireNonNull(offenseFormation, "offenseFormation");
    Objects.requireNonNull(dc, "dc");
    Objects.requireNonNull(defenseProfile, "defenseProfile");
    Objects.requireNonNull(rng, "rng");

    var situation = Situation.from(state);
    var bundle = adjustments.compute(state.stats().forOffense(state.possession()), dc);
    var extraRushers = pickExtraRushers(situation, dc, defenseProfile, bundle, rng);
    var manZone = pickManZone(offenseFormation, dc, bundle, rng);
    var shell = pickShell(offenseFormation, dc, bundle, manZone, rng);
    var personnel = pickPersonnel(situation, offenseFormation, dc, rng);
    return new DefensiveCall(shell, manZone, extraRushers, personnel);
  }

  private int pickExtraRushers(
      Situation situation,
      DefensiveCoachTendencies dc,
      RosterProfile defenseProfile,
      DefensiveAdjustments bundle,
      RandomSource rng) {
    var base = DefensiveCallBands.BASELINE_BLITZ_RATE;
    var situationalShift = blitzSituationalShift(situation);
    var coachShift = normalize(dc.blitzFrequency()) * BLITZ_MAX_LOGIT_SHIFT;
    var downsBoost = situation.down() >= 3 ? normalize(dc.aggressionOnDowns()) * 0.3 : 0.0;
    var rosterShift = defenseProfile.pressureLean() * ROSTER_PRESSURE_LEAN_SCALE;
    var blitzRate =
        sigmoid(
            logit(base)
                + situationalShift
                + coachShift
                + downsBoost
                + rosterShift
                + bundle.blitzLogitShift());

    if (rng.nextDouble() >= blitzRate) {
      return 0;
    }
    return sample(DefensiveCallBands.BLITZ_COUNT_WEIGHTS, rng, 1);
  }

  private ManZone pickManZone(
      OffensiveFormation formation,
      DefensiveCoachTendencies dc,
      DefensiveAdjustments bundle,
      RandomSource rng) {
    var base = bands.manRateBaseline(formation);
    var shift = normalize(dc.manZoneBias()) * MAN_MAX_LOGIT_SHIFT;
    var manRate = sigmoid(logit(base) + shift + bundle.manRateLogitShift());
    return rng.nextDouble() < manRate ? ManZone.MAN : ManZone.ZONE;
  }

  private CoverageShell pickShell(
      OffensiveFormation formation,
      DefensiveCoachTendencies dc,
      DefensiveAdjustments bundle,
      ManZone manZone,
      RandomSource rng) {
    var baseline = bands.shellBaseline(formation);
    var singleHighLean = normalize(dc.coverageShellBias());
    var adjMult = bundle.singleHighShellMultiplier();
    var weights = new EnumMap<CoverageShell, Double>(CoverageShell.class);
    for (var entry : baseline.entrySet()) {
      var shell = entry.getKey();
      var w = entry.getValue();
      if (!matchesType(shell, manZone)) {
        w *= 0.15;
      }
      w *= singleHighMultiplier(shell, singleHighLean);
      if (isSingleHigh(shell)) {
        w *= adjMult;
      }
      weights.put(shell, w);
    }
    return sample(normalize(weights), rng, CoverageShell.COVER_3);
  }

  private static boolean isSingleHigh(CoverageShell shell) {
    return switch (shell) {
      case COVER_0, COVER_1, COVER_3 -> true;
      default -> false;
    };
  }

  private DefensivePackage pickPersonnel(
      Situation situation,
      OffensiveFormation formation,
      DefensiveCoachTendencies dc,
      RandomSource rng) {
    if (situation.fieldZone() == Situation.FieldZone.GOAL_TO_GO
        && situation.distanceBucket() == Situation.DistanceBucket.SHORT_1_2) {
      return DefensivePackage.GOAL_LINE;
    }
    if (situation.down() == 3
        && situation.distanceBucket() == Situation.DistanceBucket.VERY_LONG_11_PLUS) {
      return DefensivePackage.DIME;
    }
    var subAggression = normalize(dc.substitutionAggression());
    // LinkedHashMap (not Map.of) — iteration order feeds a cumulative weighted draw, and Map.of
    // is JVM-salted.
    var baseWeight = new LinkedHashMap<DefensivePackage, Double>();
    switch (formation) {
      case I_FORM, JUMBO -> {
        baseWeight.put(DefensivePackage.BASE, 0.8);
        baseWeight.put(DefensivePackage.NICKEL, 0.2);
      }
      case SHOTGUN, EMPTY, PISTOL, SINGLEBACK -> {
        baseWeight.put(DefensivePackage.NICKEL, 0.75);
        baseWeight.put(DefensivePackage.DIME, 0.15);
        baseWeight.put(DefensivePackage.BASE, 0.10);
      }
    }
    var weights = new LinkedHashMap<DefensivePackage, Double>();
    for (var entry : baseWeight.entrySet()) {
      var w = entry.getValue();
      if (entry.getKey() == DefensivePackage.BASE) {
        w *= (1.0 - 0.5 * Math.max(0, subAggression));
      } else if (entry.getKey() == DefensivePackage.NICKEL
          || entry.getKey() == DefensivePackage.DIME) {
        w *= (1.0 + 0.3 * Math.max(0, subAggression));
      }
      weights.put(entry.getKey(), w);
    }
    return sample(normalize(weights), rng, DefensivePackage.NICKEL);
  }

  private static boolean matchesType(CoverageShell shell, ManZone manZone) {
    return switch (shell.type()) {
      case MAN -> manZone == ManZone.MAN;
      case ZONE -> manZone == ManZone.ZONE;
      case OTHER -> true;
    };
  }

  private static double singleHighMultiplier(CoverageShell shell, double singleHighLean) {
    var direction = isSingleHigh(shell) ? singleHighLean : -singleHighLean;
    if (direction >= 0) {
      return 1.0 + direction * (SHELL_MAX_MULTIPLIER - 1.0);
    }
    return 1.0 + direction * (1.0 - 1.0 / SHELL_MAX_MULTIPLIER);
  }

  private static double blitzSituationalShift(Situation situation) {
    var shift = 0.0;
    if (situation.down() == 3 || situation.down() == 4) {
      shift +=
          switch (situation.distanceBucket()) {
            case VERY_LONG_11_PLUS, LONG_7_10 -> 0.4;
            case MEDIUM_3_6 -> 0.2;
            case SHORT_1_2 -> -0.2;
          };
    }
    if (situation.fieldZone() == Situation.FieldZone.GOAL_TO_GO
        || situation.fieldZone() == Situation.FieldZone.RED_ZONE_INNER) {
      shift += 0.2;
    }
    return shift;
  }

  private static double normalize(int axis) {
    return Math.max(-1.0, Math.min(1.0, (axis - 50) / 50.0));
  }

  private static double logit(double p) {
    var clamped = Math.max(1e-6, Math.min(1.0 - 1e-6, p));
    return Math.log(clamped / (1.0 - clamped));
  }

  private static double sigmoid(double x) {
    return 1.0 / (1.0 + Math.exp(-x));
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
}
