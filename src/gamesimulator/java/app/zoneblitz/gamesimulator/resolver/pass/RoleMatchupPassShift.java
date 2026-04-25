package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.List;
import java.util.function.ToDoubleFunction;

/**
 * Concept-aware, role-keyed pass-matchup shift with physical-fit clamping. Phase-5 successor to
 * {@code ClampedPassMatchupShift} — the math currently mirrors the legacy bucket aggregation
 * (coverage leg + pass-rush leg, weighted per concept profile) so calibration parity is preserved.
 *
 * <p>Phase 7+ extends this class to add per-{@code RolePair} contributions sourced from each
 * scheme's {@code RoleDemandTable}: when scheme demand data is populated, individual pair deltas
 * sum into the shift on top of (or in place of) the bucket-level aggregate. Until then this is a
 * structural rename — the class name signals direction.
 *
 * <p>Formula per leg (coverage-leg and pass-rush-leg):
 *
 * <pre>
 *   physical_gap = off_physical_score(weights) − def_physical_score(weights)
 *   floor        = −1 + 0.5 × max(0, physical_gap)
 *   ceiling      = +1 + 0.5 × min(0, physical_gap)
 *   delta        = clamp(off_skill(weights) − def_skill(weights), floor, ceiling)
 * </pre>
 *
 * <p>The result is {@code coverageLegWeight × coverageDelta − passRushLegWeight × passRushDelta}.
 * Physical gap creates the window; skill delta moves within it. {@code DROPBACK} uses {@code
 * 1.0/1.0} so the legacy {@code coverage − pass_rush} shape is preserved exactly — baseline parity
 * with {@link MatchupPassResolver.PassMatchupShift#ZERO} remains a structural invariant.
 */
public final class RoleMatchupPassShift implements MatchupPassResolver.PassMatchupShift {

  @Override
  public double compute(PassMatchupContext context, RandomSource rng) {
    var profile = PassConceptProfiles.forConcept(context.concept());
    var roles = context.roles();

    var coverage =
        clampedDelta(
            aggregate(roles.routeRunners(), profile.offRoute()::skillScore),
            aggregate(roles.coverageDefenders(), profile.defCoverage()::skillScore),
            aggregate(roles.routeRunners(), p -> profile.offRoute().physicalScore(p.physical())),
            aggregate(
                roles.coverageDefenders(), p -> profile.defCoverage().physicalScore(p.physical())));
    var passRush =
        clampedDelta(
            aggregate(roles.passRushers(), profile.defPassRush()::skillScore),
            aggregate(roles.passBlockers(), profile.offProtection()::skillScore),
            aggregate(roles.passRushers(), p -> profile.defPassRush().physicalScore(p.physical())),
            aggregate(
                roles.passBlockers(), p -> profile.offProtection().physicalScore(p.physical())));

    return profile.coverageLegWeight() * coverage - profile.passRushLegWeight() * passRush;
  }

  private static double clampedDelta(
      double offSkill, double defSkill, double offPhys, double defPhys) {
    var gap = offPhys - defPhys;
    var floor = -1.0 + 0.5 * Math.max(0.0, gap);
    var ceiling = 1.0 + 0.5 * Math.min(0.0, gap);
    var raw = offSkill - defSkill;
    return Math.max(floor, Math.min(ceiling, raw));
  }

  private static double aggregate(List<Player> players, ToDoubleFunction<Player> scorer) {
    if (players.isEmpty()) {
      return 0.0;
    }
    var sum = 0.0;
    for (var p : players) {
      sum += scorer.applyAsDouble(p);
    }
    return sum / players.size();
  }
}
