package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.formation.CoverageShell;
import app.zoneblitz.gamesimulator.resolver.PassRoles;
import app.zoneblitz.gamesimulator.resolver.pass.MatchupPassResolver.PassMatchupShift;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Coverage-shell contribution to the pass matchup shift.
 *
 * <p>Two-term shift:
 *
 * <ul>
 *   <li><b>Shell base</b> — per-{@link CoverageShell} signed scalar; the calibration harness will
 *       tune shell-vs-offense biases as concept×shell fit modeling lands. Default table is empty
 *       (every shell maps to {@code 0.0}).
 *   <li><b>Secondary fit</b> — a small attribute-driven term comparing route runners' separation
 *       skills (route running, release) against coverage defenders' coverage technique and press
 *       coverage. Stacks under the role-keyed shift; magnitude bounded by {@link
 *       #SECONDARY_FIT_ENVELOPE}. With league-average attributes on both sides the term is exactly
 *       zero, preserving baseline parity.
 * </ul>
 */
public final class CoverageShellPassShift implements PassMatchupShift {

  /**
   * Maximum absolute contribution from the secondary-fit term at saturated attributes. Tuned
   * conservatively (~5% of the role-keyed shift's saturation magnitude) so this term reinforces the
   * role-keyed delta without breaching the talent-axis-sweep 30pp win-rate smoothness envelope at
   * small attribute deltas.
   */
  public static final double SECONDARY_FIT_ENVELOPE = 0.03;

  private final Map<CoverageShell, Double> shiftsByShell;

  public CoverageShellPassShift() {
    this(Map.of());
  }

  public CoverageShellPassShift(Map<CoverageShell, Double> shiftsByShell) {
    Objects.requireNonNull(shiftsByShell, "shiftsByShell");
    this.shiftsByShell = new EnumMap<>(CoverageShell.class);
    this.shiftsByShell.putAll(shiftsByShell);
  }

  @Override
  public double compute(PassMatchupContext context, RandomSource rng) {
    Objects.requireNonNull(context, "context");
    var shellBase = shiftsByShell.getOrDefault(context.shell(), 0.0);
    var secondaryFit = secondaryFit(context.roles());
    return shellBase + secondaryFit;
  }

  private static double secondaryFit(PassRoles roles) {
    var routeSkill = meanRouteSkill(roles.routeRunners());
    var coverageSkill = meanCoverageSkill(roles.coverageDefenders());
    if (Double.isNaN(routeSkill) || Double.isNaN(coverageSkill)) {
      return 0.0;
    }
    return SECONDARY_FIT_ENVELOPE * (routeSkill - coverageSkill);
  }

  private static double meanRouteSkill(List<Player> receivers) {
    if (receivers.isEmpty()) {
      return Double.NaN;
    }
    var sum = 0.0;
    for (var p : receivers) {
      sum += centered((p.skill().routeRunning() + p.skill().release()) / 2.0);
    }
    return sum / receivers.size();
  }

  private static double meanCoverageSkill(List<Player> defenders) {
    if (defenders.isEmpty()) {
      return Double.NaN;
    }
    var sum = 0.0;
    for (var p : defenders) {
      sum += centered((p.skill().coverageTechnique() + p.skill().pressCoverage()) / 2.0);
    }
    return sum / defenders.size();
  }

  private static double centered(double zeroToHundred) {
    return (zeroToHundred / 100.0 - 0.5) * 2.0;
  }
}
