package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.resolver.pass.MatchupPassResolver.PassMatchupShift;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.role.DefensiveRole;
import app.zoneblitz.gamesimulator.role.OffensiveRole;
import app.zoneblitz.gamesimulator.role.OffensiveRoleAssignment;
import java.util.EnumSet;
import java.util.Objects;
import java.util.Set;

/**
 * Closes the run-success → play-action loop. When the defense has loaded the box because the
 * offense has been running well (signalled via {@link PassMatchupContext#boxLoadingShift()}), a
 * play-action call gets a positive matchup shift — the LBs bite the run fake, leaving voids in the
 * coverage. Other pass concepts get nothing from this shift.
 *
 * <p>The base box-loading shift is then scaled by three offensive believability factors and
 * dampened by one defensive recognition factor:
 *
 * <ul>
 *   <li><b>QB play-action skill</b> — a great PA fake amplifies the freeze; a weak fake bleeds the
 *       boost away.
 *   <li><b>RB run-threat</b> — the back actually has to look like a credible runner. Vision +
 *       break-tackle blend captures "would the LBs respect this guy on a pure run?".
 *   <li><b>OL run-block</b> — a stout run-blocking front sells the fake; a finesse line that never
 *       moves bodies bleeds believability.
 *   <li><b>Defense second-level play recognition</b> — LBs/safeties who diagnose the fake quickly
 *       stay in their coverage zones, dampening the boost.
 * </ul>
 *
 * <p>With league-average attributes (50/50/50) every factor evaluates to 1.0 and the legacy
 * magnitude is preserved, keeping the calibration baseline intact.
 */
public final class PlayActionBoxLoadingShift implements PassMatchupShift {

  /** Default magnitude per implied extra-box-defender. Positive — favors offense on PA only. */
  public static final double DEFAULT_SHIFT_PER_DEFENDER = 0.25;

  /** Maximum scaling/dampening factor either direction; clamps elite/floor amplification. */
  static final double MAX_FACTOR_SHIFT = 0.5;

  /** Maximum scaling factor for the RB run-threat believability term. */
  static final double MAX_RB_FACTOR_SHIFT = 0.3;

  /** Maximum scaling factor for the OL run-block believability term. */
  static final double MAX_OL_FACTOR_SHIFT = 0.3;

  private static final Set<DefensiveRole> SECOND_LEVEL =
      EnumSet.of(
          DefensiveRole.MIKE_LB,
          DefensiveRole.WILL_LB,
          DefensiveRole.SAM_LB,
          DefensiveRole.STAND_UP_OLB,
          DefensiveRole.DEEP_S,
          DefensiveRole.BOX_S,
          DefensiveRole.DIME_LB);

  private static final Set<OffensiveRole> RB_ROLES =
      EnumSet.of(OffensiveRole.RB_RUSH, OffensiveRole.RB_RECEIVE, OffensiveRole.RB_PROTECT);

  private static final Set<OffensiveRole> OL_ROLES =
      EnumSet.of(
          OffensiveRole.LT, OffensiveRole.LG, OffensiveRole.C, OffensiveRole.RG, OffensiveRole.RT);

  private final double shiftPerDefender;

  public PlayActionBoxLoadingShift() {
    this(DEFAULT_SHIFT_PER_DEFENDER);
  }

  public PlayActionBoxLoadingShift(double shiftPerDefender) {
    this.shiftPerDefender = shiftPerDefender;
  }

  @Override
  public double compute(PassMatchupContext context, RandomSource rng) {
    Objects.requireNonNull(context, "context");
    Objects.requireNonNull(rng, "rng");
    if (context.concept() != PassConcept.PLAY_ACTION) {
      return 0.0;
    }
    var base = context.boxLoadingShift() * shiftPerDefender;
    if (base == 0.0) {
      return 0.0;
    }
    var qb = context.assignment().offense().players().get(OffensiveRole.QB_POCKET);
    if (qb == null) {
      qb = context.assignment().offense().players().get(OffensiveRole.QB_MOVEMENT);
    }
    var qbFactor = qb == null ? 1.0 : 1.0 + MAX_FACTOR_SHIFT * centered(qb.skill().playAction());
    var rbFactor = 1.0 + MAX_RB_FACTOR_SHIFT * meanRbRunThreat(context.assignment().offense());
    var olFactor = 1.0 + MAX_OL_FACTOR_SHIFT * meanOlRunBlock(context.assignment().offense());
    var defenseFactor = 1.0 - MAX_FACTOR_SHIFT * meanSecondLevelPlayRecognition(context);
    return base * qbFactor * rbFactor * olFactor * defenseFactor;
  }

  private static double meanSecondLevelPlayRecognition(PassMatchupContext context) {
    var defenders = context.assignment().defense().players();
    var n = 0;
    var sum = 0.0;
    for (var entry : defenders.entrySet()) {
      if (!SECOND_LEVEL.contains(entry.getKey())) {
        continue;
      }
      sum += entry.getValue().tendencies().playRecognition();
      n++;
    }
    if (n == 0) {
      return 0.0;
    }
    return centered(sum / n);
  }

  private static double meanRbRunThreat(OffensiveRoleAssignment offense) {
    var n = 0;
    var sum = 0.0;
    for (var entry : offense.players().entrySet()) {
      if (!RB_ROLES.contains(entry.getKey())) {
        continue;
      }
      var skill = entry.getValue().skill();
      sum += (skill.ballCarrierVision() + skill.breakTackle()) / 2.0;
      n++;
    }
    if (n == 0) {
      return 0.0;
    }
    return centered(sum / n);
  }

  private static double meanOlRunBlock(OffensiveRoleAssignment offense) {
    var n = 0;
    var sum = 0.0;
    for (var entry : offense.players().entrySet()) {
      if (!OL_ROLES.contains(entry.getKey())) {
        continue;
      }
      sum += entry.getValue().skill().runBlock();
      n++;
    }
    if (n == 0) {
      return 0.0;
    }
    return centered(sum / n);
  }

  private static double centered(double zeroToHundred) {
    return (zeroToHundred / 100.0 - 0.5) * 2.0;
  }

  private static double centered(int zeroToHundred) {
    return centered((double) zeroToHundred);
  }
}
