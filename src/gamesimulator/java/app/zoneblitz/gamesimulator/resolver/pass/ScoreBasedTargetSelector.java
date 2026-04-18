package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.resolver.PassRoles;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;

/**
 * Default {@link TargetSelector}: scores each route runner with the design-doc formula and picks
 * the argmax. Under the hood:
 *
 * <ul>
 *   <li><b>Per-receiver matchup</b> {@code m_route_i} is a two-axis (route running + hands vs.
 *       coverage technique) delta re-centered to {@code [-1, +1]}, matching the scaling of {@link
 *       ClampedPassMatchupShift}. Coverage assignment is positional round-robin.
 *   <li><b>Depth value</b> rewards shallow throws slightly — shorter routes are "more open" absent
 *       any other signal.
 *   <li><b>Position-tier bias</b> separates WRs (primary reads) from TEs (secondary) from RBs
 *       (checkdown). Within a tier receivers are symmetric — target share inside the tier is
 *       noise-driven, not a dial. The tier step is calibrated so the roster-level target
 *       distribution reproduces {@code position-concentration.json} for equal-attribute rosters.
 *   <li><b>Gaussian processing noise</b> is drawn from the parent {@link RandomSource} once per
 *       receiver; σ is a decreasing function of the QB's {@link
 *       app.zoneblitz.gamesimulator.roster.Tendencies} {@code processing} and {@code footballIq}.
 * </ul>
 *
 * <p>Gunslinger / game-manager archetypes (a future tendency lever) will shift depth preference
 * here. The tendency field already ships on {@code Player.tendencies()} — the hook is a no-op until
 * archetype data arrives.
 */
public final class ScoreBasedTargetSelector implements TargetSelector {

  private static final double TIER_WR = 1.20;
  private static final double TIER_TE = 0.60;
  private static final double TIER_RB = 0.00;
  private static final double DEPTH_VALUE_STEP = 0.02;
  private static final double SIGMA_AT_AVERAGE = 0.35;
  private static final double SIGMA_AT_ELITE = 0.10;
  private static final double SIGMA_AT_FLOOR = 0.70;

  @Override
  public TargetChoice select(
      PlayCaller.PlayCall call, PassRoles roles, Player qb, RandomSource rng) {
    var receivers = roles.routeRunners();
    if (receivers.isEmpty()) {
      return new TargetChoice.Throwaway();
    }
    var coverage = roles.coverageDefenders();
    var sigma = sigma(qb);

    var bestIdx = -1;
    var bestScore = Double.NEGATIVE_INFINITY;
    for (var i = 0; i < receivers.size(); i++) {
      var receiver = receivers.get(i);
      var defender = coverage.isEmpty() ? null : coverage.get(i % coverage.size());
      var depth = routeDepth(receiver.position());
      var score =
          routeMatchup(receiver, defender)
              + depthValue(depth)
              + tierBias(receiver.position())
              + rng.nextGaussian() * sigma;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    var target = receivers.get(bestIdx);
    return new TargetChoice.Throw(target.id(), routeDepth(target.position()));
  }

  private static double routeMatchup(Player receiver, Player defender) {
    var off = centered((receiver.skill().routeRunning() + receiver.skill().hands()) / 2.0);
    if (defender == null) {
      return off;
    }
    var def = centered(defender.skill().coverageTechnique());
    return off - def;
  }

  private static int routeDepth(Position position) {
    return switch (position) {
      case WR -> 11;
      case TE -> 7;
      case RB -> 1;
      default -> 8;
    };
  }

  private static double depthValue(int depth) {
    return -DEPTH_VALUE_STEP * depth;
  }

  private static double tierBias(Position position) {
    return switch (position) {
      case WR -> TIER_WR;
      case TE -> TIER_TE;
      case RB -> TIER_RB;
      default -> 0.0;
    };
  }

  private static double sigma(Player qb) {
    var t = qb.tendencies();
    var combined = (t.processing() + t.footballIq()) / 2.0;
    if (combined >= 100.0) {
      return SIGMA_AT_ELITE;
    }
    if (combined <= 0.0) {
      return SIGMA_AT_FLOOR;
    }
    if (combined >= 50.0) {
      var frac = (combined - 50.0) / 50.0;
      return SIGMA_AT_AVERAGE + frac * (SIGMA_AT_ELITE - SIGMA_AT_AVERAGE);
    }
    var frac = combined / 50.0;
    return SIGMA_AT_FLOOR + frac * (SIGMA_AT_AVERAGE - SIGMA_AT_FLOOR);
  }

  private static double centered(double zeroToHundred) {
    return (zeroToHundred / 100.0 - 0.5) * 2.0;
  }
}
