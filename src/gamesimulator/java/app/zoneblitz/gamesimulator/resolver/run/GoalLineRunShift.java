package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.resolver.run.MatchupRunResolver.RunMatchupShift;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.role.DefensiveRole;
import app.zoneblitz.gamesimulator.role.DefensiveRoleAssignment;
import app.zoneblitz.gamesimulator.role.OffensiveRole;
import app.zoneblitz.gamesimulator.role.OffensiveRoleAssignment;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.EnumSet;
import java.util.Objects;
import java.util.Set;

/**
 * Field-position contribution to the run matchup shift. Compresses probability mass away from
 * {@code BREAKAWAY} and toward {@code STUFF}/{@code NORMAL} as the offense approaches the opponent
 * goal line.
 *
 * <p>Calibration reference (nflfastR 2020–2024, regular season, rushes from {@code yardline_100}):
 *
 * <ul>
 *   <li>1-yard line: TD% ≈ 58%, stuff% (≤0 yds) ≈ 42%, breakaway% (≥10 yds) ≈ 0%
 *   <li>2-yard line: TD% ≈ 46%, breakaway% ≈ 0%
 *   <li>3-yard line: TD% ≈ 37%, breakaway% ≈ 0%
 *   <li>5-yard line: TD% ≈ 24%, breakaway% ≈ 0%
 *   <li>10-yard line: breakaway% ≈ 11% (back at mid-field baseline)
 * </ul>
 *
 * <p>The shipped run bands are league-average across all field positions, so at the 1 they still
 * carry ~2% {@code BREAKAWAY} mass and no {@code STUFF} elevation. This shift applies a negative
 * scalar inside the red zone — negative {@link RunMatchupShift} composes with the existing
 * per-outcome β coefficients ({@code STUFF = -0.4}, {@code BREAKAWAY = +0.5}) to push probability
 * mass from breakaway toward stuff/normal. End-zone clamping in the scoring path then converts most
 * {@code NORMAL} gains from the 1 into rush TDs, matching the observed TD rate.
 *
 * <p>On short-yardage snaps ({@code yardsToGo ≤ 1}) concepts biased toward downhill push ({@code
 * POWER}, {@code QB_SNEAK}) get a small positive offset so their conversion rate isn't
 * over-penalised by the red-zone ramp. Situational play selection (who calls the sneak) is out of
 * scope — issue #571 tracks this explicitly.
 *
 * <p>The red-zone ramp is then scaled by a goal-line trench factor: RB power/strength and break-
 * tackle plus OL run-block on offense, DL strength + DL/LB block-shedding and LB tackling on
 * defense. With league-average attributes the factor is exactly {@code 1.0} so baseline parity with
 * the situational-only ramp is preserved. Magnitude is bounded by {@link #DEFAULT_TRENCH_ENVELOPE}
 * so an elite goal-line offense halves the ramp while an elite goal-line defense inflates it by
 * 50%.
 */
public final class GoalLineRunShift implements RunMatchupShift {

  /**
   * Per-yard magnitude of the red-zone ramp. Kicks in at {@code yardsToGoal ≤ 10} and peaks at
   * {@code yardsToGoal == 1}: {@code shift = -0.2 × (11 − yardsToGoal)} → {@code -2.0} at the 1,
   * {@code -1.2} at the 5, {@code -0.2} at the 10. Zero outside the red zone.
   */
  public static final double DEFAULT_SHIFT_PER_YARD = 0.2;

  /** Where the ramp turns on (yards from the opponent goal line, inclusive). */
  public static final int DEFAULT_RED_ZONE_THRESHOLD = 10;

  /**
   * Offset applied when short-yardage ({@code yardsToGo ≤ 1}) meets {@code POWER}/{@code QB_SNEAK}.
   * Partially counters the red-zone negative so short-yardage sneaks still convert at realistic
   * rates inside the 5.
   */
  public static final double DEFAULT_SHORT_YARDAGE_POWER_BONUS = 0.4;

  /**
   * Default trench-margin envelope. The offense-vs-defense goal-line margin sits in {@code [-1,
   * +1]}; this scalar caps how much the ramp can be inflated or muted by trench dominance.
   */
  public static final double DEFAULT_TRENCH_ENVELOPE = 0.5;

  private static final Set<OffensiveRole> OL_ROLES =
      EnumSet.of(
          OffensiveRole.LT, OffensiveRole.LG, OffensiveRole.C, OffensiveRole.RG, OffensiveRole.RT);

  private static final Set<DefensiveRole> DL_ROLES =
      EnumSet.of(
          DefensiveRole.NOSE,
          DefensiveRole.THREE_TECH,
          DefensiveRole.FIVE_TECH,
          DefensiveRole.EDGE);

  private static final Set<DefensiveRole> BOX_LB_ROLES =
      EnumSet.of(
          DefensiveRole.MIKE_LB,
          DefensiveRole.WILL_LB,
          DefensiveRole.SAM_LB,
          DefensiveRole.STAND_UP_OLB,
          DefensiveRole.BOX_S);

  private final double shiftPerYard;
  private final int redZoneThreshold;
  private final double shortYardagePowerBonus;
  private final double trenchEnvelope;

  public GoalLineRunShift() {
    this(
        DEFAULT_SHIFT_PER_YARD,
        DEFAULT_RED_ZONE_THRESHOLD,
        DEFAULT_SHORT_YARDAGE_POWER_BONUS,
        DEFAULT_TRENCH_ENVELOPE);
  }

  public GoalLineRunShift(
      double shiftPerYard, int redZoneThreshold, double shortYardagePowerBonus) {
    this(shiftPerYard, redZoneThreshold, shortYardagePowerBonus, DEFAULT_TRENCH_ENVELOPE);
  }

  public GoalLineRunShift(
      double shiftPerYard,
      int redZoneThreshold,
      double shortYardagePowerBonus,
      double trenchEnvelope) {
    this.shiftPerYard = shiftPerYard;
    this.redZoneThreshold = redZoneThreshold;
    this.shortYardagePowerBonus = shortYardagePowerBonus;
    this.trenchEnvelope = trenchEnvelope;
  }

  @Override
  public double compute(RunMatchupContext context, RandomSource rng) {
    Objects.requireNonNull(context, "context");
    Objects.requireNonNull(rng, "rng");
    var yardsToGoal = context.yardsToGoal();
    if (yardsToGoal > redZoneThreshold) {
      return 0.0;
    }
    var redZone = -shiftPerYard * (redZoneThreshold + 1 - yardsToGoal);
    var concept = context.concept();
    if (context.yardsToGo() <= 1
        && (concept == RunConcept.POWER || concept == RunConcept.QB_SNEAK)) {
      return (redZone + shortYardagePowerBonus) * trenchFactor(context);
    }
    return redZone * trenchFactor(context);
  }

  private double trenchFactor(RunMatchupContext context) {
    var offense = goalLineOffense(context);
    var defense = goalLineDefense(context);
    if (Double.isNaN(offense) || Double.isNaN(defense)) {
      return 1.0;
    }
    var margin = defense - offense;
    return 1.0 + margin * trenchEnvelope;
  }

  private static double goalLineOffense(RunMatchupContext context) {
    var off = context.assignment().offense();
    var carrier = carrierScore(context, off);
    var line = lineScore(off);
    if (Double.isNaN(carrier) && Double.isNaN(line)) {
      return Double.NaN;
    }
    if (Double.isNaN(carrier)) {
      return line;
    }
    if (Double.isNaN(line)) {
      return carrier;
    }
    return 0.5 * carrier + 0.5 * line;
  }

  private static double carrierScore(RunMatchupContext context, OffensiveRoleAssignment offense) {
    var carrier = context.roles().ballCarrier().orElse(null);
    if (carrier == null) {
      carrier = offense.players().get(OffensiveRole.RB_RUSH);
    }
    if (carrier == null) {
      carrier = offense.players().get(OffensiveRole.FB_LEAD);
    }
    if (carrier == null) {
      carrier = offense.players().get(OffensiveRole.QB_POCKET);
    }
    if (carrier == null) {
      return Double.NaN;
    }
    var power = centered(carrier.physical().power());
    var strength = centered(carrier.physical().strength());
    var breakTackle = centered(carrier.skill().breakTackle());
    return 0.4 * power + 0.3 * strength + 0.3 * breakTackle;
  }

  private static double lineScore(OffensiveRoleAssignment offense) {
    var n = 0;
    var sum = 0.0;
    for (var entry : offense.players().entrySet()) {
      if (!OL_ROLES.contains(entry.getKey())) {
        continue;
      }
      var p = entry.getValue();
      sum += 0.7 * centered(p.skill().runBlock()) + 0.3 * centered(p.physical().strength());
      n++;
    }
    return n == 0 ? Double.NaN : sum / n;
  }

  private static double goalLineDefense(RunMatchupContext context) {
    var def = context.assignment().defense();
    var dl = aggregate(def, DL_ROLES, GoalLineRunShift::dlAnchor);
    var lb = aggregate(def, BOX_LB_ROLES, GoalLineRunShift::lbStackShed);
    if (Double.isNaN(dl) && Double.isNaN(lb)) {
      return Double.NaN;
    }
    if (Double.isNaN(dl)) {
      return lb;
    }
    if (Double.isNaN(lb)) {
      return dl;
    }
    return 0.6 * dl + 0.4 * lb;
  }

  private static double aggregate(
      DefensiveRoleAssignment defense,
      Set<DefensiveRole> roles,
      java.util.function.ToDoubleFunction<Player> scorer) {
    var n = 0;
    var sum = 0.0;
    for (var entry : defense.players().entrySet()) {
      if (!roles.contains(entry.getKey())) {
        continue;
      }
      sum += scorer.applyAsDouble(entry.getValue());
      n++;
    }
    return n == 0 ? Double.NaN : sum / n;
  }

  private static double dlAnchor(Player player) {
    var strength = centered(player.physical().strength());
    var shed = centered(player.skill().blockShedding());
    return 0.5 * strength + 0.5 * shed;
  }

  private static double lbStackShed(Player player) {
    var shed = centered(player.skill().blockShedding());
    var tackling = centered(player.skill().tackling());
    return 0.5 * shed + 0.5 * tackling;
  }

  private static double centered(int zeroToHundred) {
    return (zeroToHundred / 100.0 - 0.5) * 2.0;
  }
}
