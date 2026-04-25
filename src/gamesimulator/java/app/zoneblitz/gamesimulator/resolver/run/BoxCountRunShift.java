package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.formation.BoxCountSampler;
import app.zoneblitz.gamesimulator.formation.PlayType;
import app.zoneblitz.gamesimulator.resolver.run.MatchupRunResolver.RunMatchupShift;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.Objects;

/**
 * Box-count contribution to the run matchup shift.
 *
 * <p>Samples a defender-in-box count from the supplied {@link BoxCountSampler} (using a split child
 * RNG stream so the main outcome/yardage stream is undisturbed) and returns {@code (sampled −
 * expected) × shiftPerDefender}. With the calibrated BDB slope of −0.667 YPC per extra defender, a
 * default {@code shiftPerDefender} of {@code -0.25} translates a 3-defender heavy-box tilt into
 * roughly a one-talent-tier disadvantage — comparable magnitude to {@link RoleMatchupRunShift}'s
 * output, which is the point of compositing them.
 */
public final class BoxCountRunShift implements RunMatchupShift {

  /** Default shift magnitude per extra defender in the box. Tunable by the calibration harness. */
  public static final double DEFAULT_SHIFT_PER_DEFENDER = -0.25;

  private static final long BOX_SPLIT_KEY = 0x1111_bbccL;

  private final BoxCountSampler sampler;
  private final double shiftPerDefender;

  public BoxCountRunShift(BoxCountSampler sampler) {
    this(sampler, DEFAULT_SHIFT_PER_DEFENDER);
  }

  public BoxCountRunShift(BoxCountSampler sampler, double shiftPerDefender) {
    this.sampler = Objects.requireNonNull(sampler, "sampler");
    this.shiftPerDefender = shiftPerDefender;
  }

  @Override
  public double compute(RunMatchupContext context, RandomSource rng) {
    Objects.requireNonNull(context, "context");
    Objects.requireNonNull(rng, "rng");
    var child = rng.split(BOX_SPLIT_KEY);
    var sampled = sampler.sample(context.formation(), PlayType.RUN, child);
    var expected = sampler.expectedBox(context.formation(), PlayType.RUN);
    return (sampled - expected) * shiftPerDefender;
  }
}
