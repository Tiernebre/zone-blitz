package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.formation.BoxCountSampler;
import app.zoneblitz.gamesimulator.formation.PlayType;
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
 * Box-count contribution to the run matchup shift.
 *
 * <p>Samples a defender-in-box count from the supplied {@link BoxCountSampler} (using a split child
 * RNG stream so the main outcome/yardage stream is undisturbed) and returns {@code (sampled −
 * expected) × shiftPerDefender}, then scales the result by an OL-vs-DL trench factor so heavy boxes
 * hurt less when the line dominates and more when the front does.
 *
 * <p>Trench margin combines OL run-block ({@link
 * app.zoneblitz.gamesimulator.roster.Skill#runBlock()}) against DL block-shedding and strength
 * ({@link app.zoneblitz.gamesimulator.roster.Skill#blockShedding()}, {@link
 * app.zoneblitz.gamesimulator.roster.Physical#strength()}). With league-average attributes the
 * margin is zero and the shift reduces exactly to the legacy {@code (sampled − expected) ×
 * shiftPerDefender}, preserving baseline parity.
 *
 * <p>Magnitude: at the {@link #DEFAULT_TRENCH_ENVELOPE} default of {@code 0.5}, an elite OL vs.
 * average DL halves the box-count contribution, while an elite DL vs. average OL inflates it by 50%
 * — meaningful but bounded so this composes with the role-keyed talent shift without dominating.
 *
 * <p>With the calibrated BDB slope of −0.667 YPC per extra defender, a default {@code
 * shiftPerDefender} of {@code -0.25} translates a 3-defender heavy-box tilt into roughly a
 * one-talent-tier disadvantage — comparable magnitude to {@link RoleMatchupRunShift}'s output,
 * which is the point of compositing them.
 */
public final class BoxCountRunShift implements RunMatchupShift {

  /** Default shift magnitude per extra defender in the box. Tunable by the calibration harness. */
  public static final double DEFAULT_SHIFT_PER_DEFENDER = -0.25;

  /**
   * Default trench-margin envelope. The OL-vs-DL margin sits in {@code [-1, +1]}; this scalar caps
   * how much the box-count contribution can be inflated or muted by trench dominance.
   */
  public static final double DEFAULT_TRENCH_ENVELOPE = 0.5;

  private static final long BOX_SPLIT_KEY = 0x1111_bbccL;

  private static final Set<OffensiveRole> OL_ROLES =
      EnumSet.of(
          OffensiveRole.LT, OffensiveRole.LG, OffensiveRole.C, OffensiveRole.RG, OffensiveRole.RT);

  private static final Set<DefensiveRole> DL_ROLES =
      EnumSet.of(
          DefensiveRole.NOSE,
          DefensiveRole.THREE_TECH,
          DefensiveRole.FIVE_TECH,
          DefensiveRole.EDGE);

  private final BoxCountSampler sampler;
  private final double shiftPerDefender;
  private final double trenchEnvelope;

  public BoxCountRunShift(BoxCountSampler sampler) {
    this(sampler, DEFAULT_SHIFT_PER_DEFENDER);
  }

  public BoxCountRunShift(BoxCountSampler sampler, double shiftPerDefender) {
    this(sampler, shiftPerDefender, DEFAULT_TRENCH_ENVELOPE);
  }

  public BoxCountRunShift(BoxCountSampler sampler, double shiftPerDefender, double trenchEnvelope) {
    this.sampler = Objects.requireNonNull(sampler, "sampler");
    this.shiftPerDefender = shiftPerDefender;
    this.trenchEnvelope = trenchEnvelope;
  }

  @Override
  public double compute(RunMatchupContext context, RandomSource rng) {
    Objects.requireNonNull(context, "context");
    Objects.requireNonNull(rng, "rng");
    var child = rng.split(BOX_SPLIT_KEY);
    var sampled = sampler.sample(context.formation(), PlayType.RUN, child);
    var expected = sampler.expectedBox(context.formation(), PlayType.RUN);
    var effective = sampled + context.boxLoadingShift();
    var raw = (effective - expected) * shiftPerDefender;
    return raw * trenchFactor(context);
  }

  private double trenchFactor(RunMatchupContext context) {
    var ol = averageOlRunBlock(context.assignment().offense());
    var dl = averageDlRunStop(context.assignment().defense());
    if (Double.isNaN(ol) || Double.isNaN(dl)) {
      return 1.0;
    }
    var margin = dl - ol;
    return 1.0 + margin * trenchEnvelope;
  }

  private static double averageOlRunBlock(OffensiveRoleAssignment offense) {
    var n = 0;
    var sum = 0.0;
    for (var entry : offense.players().entrySet()) {
      if (!OL_ROLES.contains(entry.getKey())) {
        continue;
      }
      sum += centered(entry.getValue().skill().runBlock());
      n++;
    }
    return n == 0 ? Double.NaN : sum / n;
  }

  private static double averageDlRunStop(DefensiveRoleAssignment defense) {
    var n = 0;
    var sum = 0.0;
    for (var entry : defense.players().entrySet()) {
      if (!DL_ROLES.contains(entry.getKey())) {
        continue;
      }
      sum += defenderRunStop(entry.getValue());
      n++;
    }
    return n == 0 ? Double.NaN : sum / n;
  }

  private static double defenderRunStop(Player player) {
    var shed = centered(player.skill().blockShedding());
    var strength = centered(player.physical().strength());
    return 0.7 * shed + 0.3 * strength;
  }

  private static double centered(int zeroToHundred) {
    return (zeroToHundred / 100.0 - 0.5) * 2.0;
  }
}
