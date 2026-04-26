package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.resolver.run.MatchupRunResolver.RunMatchupShift;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.role.DefensiveRole;
import java.util.EnumSet;
import java.util.Set;

/**
 * Defensive run-fit recognition shift. Mean second-level {@code playRecognition} (LBs and safeties)
 * tilts the matchup against the offense — a defense that diagnoses run keys at the snap fits gaps
 * faster, producing more stuffs and fewer breakaways.
 *
 * <p>Sign: positive convention is offense advantage, so high defensive recognition contributes a
 * negative shift. Magnitude is bounded by {@link #ENVELOPE} so it stacks under role-keyed talent
 * deltas. With league-average attributes the shift is zero.
 */
public final class RunRecognitionShift implements RunMatchupShift {

  /** Maximum absolute contribution at perfectly elite (or floor) defensive recognition. */
  public static final double ENVELOPE = 0.10;

  private static final Set<DefensiveRole> SECOND_LEVEL =
      EnumSet.of(
          DefensiveRole.MIKE_LB,
          DefensiveRole.WILL_LB,
          DefensiveRole.SAM_LB,
          DefensiveRole.STAND_UP_OLB,
          DefensiveRole.DEEP_S,
          DefensiveRole.BOX_S,
          DefensiveRole.DIME_LB);

  @Override
  public double compute(RunMatchupContext context, RandomSource rng) {
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
    var centered = (sum / n / 100.0 - 0.5) * 2.0;
    return -ENVELOPE * centered;
  }
}
