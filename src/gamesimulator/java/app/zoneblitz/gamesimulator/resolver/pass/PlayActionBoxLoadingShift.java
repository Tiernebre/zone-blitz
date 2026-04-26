package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.resolver.pass.MatchupPassResolver.PassMatchupShift;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.role.DefensiveRole;
import app.zoneblitz.gamesimulator.role.OffensiveRole;
import java.util.EnumSet;
import java.util.Objects;
import java.util.Set;

/**
 * Closes the run-success → play-action loop. When the defense has loaded the box because the
 * offense has been running well (signalled via {@link PassMatchupContext#boxLoadingShift()}), a
 * play-action call gets a positive matchup shift — the LBs bite the run fake, leaving voids in the
 * coverage. Other pass concepts get nothing from this shift.
 *
 * <p>The base box-loading shift is then scaled by the QB's {@code playAction} skill (a great PA
 * fake amplifies the freeze; a weak fake bleeds the boost away) and dampened by the defense's
 * second-level {@code playRecognition} (LBs/safeties who diagnose the fake quickly stay in their
 * coverage zones). With league-average attributes (50/50/50) both factors evaluate to 1.0 and the
 * legacy magnitude is preserved.
 *
 * <p>Magnitude is symmetric with {@code BoxCountRunShift}'s {@code DEFAULT_SHIFT_PER_DEFENDER} but
 * inverted in sign: where a heavier box hurts the run, the same loaded box helps PA. Defaults are
 * tuned so a one-defender box-loading shift translates to a comparable matchup magnitude as a
 * role-keyed talent advantage in the role-shift composite.
 */
public final class PlayActionBoxLoadingShift implements PassMatchupShift {

  /** Default magnitude per implied extra-box-defender. Positive — favors offense on PA only. */
  public static final double DEFAULT_SHIFT_PER_DEFENDER = 0.25;

  /** Maximum scaling/dampening factor either direction; clamps elite/floor amplification. */
  static final double MAX_FACTOR_SHIFT = 0.5;

  private static final Set<DefensiveRole> SECOND_LEVEL =
      EnumSet.of(
          DefensiveRole.MIKE_LB,
          DefensiveRole.WILL_LB,
          DefensiveRole.SAM_LB,
          DefensiveRole.STAND_UP_OLB,
          DefensiveRole.DEEP_S,
          DefensiveRole.BOX_S,
          DefensiveRole.DIME_LB);

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
    var defenseFactor = 1.0 - MAX_FACTOR_SHIFT * meanSecondLevelPlayRecognition(context);
    return base * qbFactor * defenseFactor;
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

  private static double centered(double zeroToHundred) {
    return (zeroToHundred / 100.0 - 0.5) * 2.0;
  }

  private static double centered(int zeroToHundred) {
    return centered((double) zeroToHundred);
  }
}
