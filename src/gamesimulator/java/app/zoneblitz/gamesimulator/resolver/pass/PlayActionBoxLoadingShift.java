package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.resolver.pass.MatchupPassResolver.PassMatchupShift;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.Objects;

/**
 * Closes the run-success → play-action loop. When the defense has loaded the box because the
 * offense has been running well (signalled via {@link PassMatchupContext#boxLoadingShift()}), a
 * play-action call gets a positive matchup shift — the LBs bite the run fake, leaving voids in the
 * coverage. Other pass concepts get nothing from this shift.
 *
 * <p>Magnitude is symmetric with {@code BoxCountRunShift}'s {@code DEFAULT_SHIFT_PER_DEFENDER} but
 * inverted in sign: where a heavier box hurts the run, the same loaded box helps PA. Defaults are
 * tuned so a one-defender box-loading shift translates to a comparable matchup magnitude as a
 * role-keyed talent advantage in the role-shift composite.
 */
public final class PlayActionBoxLoadingShift implements PassMatchupShift {

  /** Default magnitude per implied extra-box-defender. Positive — favors offense on PA only. */
  public static final double DEFAULT_SHIFT_PER_DEFENDER = 0.25;

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
    return context.boxLoadingShift() * shiftPerDefender;
  }
}
