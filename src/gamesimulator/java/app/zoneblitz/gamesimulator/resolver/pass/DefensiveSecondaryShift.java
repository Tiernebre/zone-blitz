package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.resolver.pass.MatchupPassResolver.PassMatchupShift;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.role.DefensiveRole;
import java.util.EnumSet;
import java.util.Set;

/**
 * Defensive secondary shift. Adds a small negative-leaning matchup nudge for coverage defenders
 * with strong {@code ballSkills} and {@code playRecognition} — a defense full of ball-hawks and
 * sharp pre-snap diagnosticians depresses the offensive shift across the board.
 *
 * <p>Players in coverage roles (CB, S, coverage LBs) contribute. A pure pass-rusher's playRec
 * doesn't help here. Magnitude is intentionally modest ({@link #ENVELOPE}) so this stacks under the
 * role-keyed delta rather than overriding it. With league-average attributes the shift is zero.
 */
public final class DefensiveSecondaryShift implements PassMatchupShift {

  /** Maximum absolute contribution at perfectly elite (or floor) coverage attributes. */
  public static final double ENVELOPE = 0.10;

  private static final Set<DefensiveRole> COVERAGE_ROLES =
      EnumSet.of(
          DefensiveRole.OUTSIDE_CB,
          DefensiveRole.SLOT_CB,
          DefensiveRole.DEEP_S,
          DefensiveRole.BOX_S,
          DefensiveRole.DIME_LB,
          DefensiveRole.MIKE_LB,
          DefensiveRole.WILL_LB,
          DefensiveRole.SAM_LB);

  @Override
  public double compute(PassMatchupContext context, RandomSource rng) {
    var defenders = context.assignment().defense().players();
    var n = 0;
    var sum = 0.0;
    for (var entry : defenders.entrySet()) {
      if (!COVERAGE_ROLES.contains(entry.getKey())) {
        continue;
      }
      var p = entry.getValue();
      var ball = (p.skill().ballSkills() / 100.0 - 0.5) * 2.0;
      var recog = (p.tendencies().playRecognition() / 100.0 - 0.5) * 2.0;
      sum += 0.6 * ball + 0.4 * recog;
      n++;
    }
    if (n == 0) {
      return 0.0;
    }
    return -ENVELOPE * (sum / n);
  }
}
