package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.List;
import java.util.function.ToDoubleFunction;

/**
 * Concept-aware, role-based pass-matchup shift with physical-fit clamping.
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
 * <p>The result is {@code coverageLegWeight × coverageDelta − passRushLegWeight × passRushDelta}
 * (pass-rush is subtracted because a defensive win there is bad for the offense), where all weight
 * families come from the {@link PassConceptProfile} chosen for the snap's {@link
 * app.zoneblitz.gamesimulator.event.PassConcept}. {@code DROPBACK} uses {@code 1.0/1.0} so the
 * legacy {@code coverage − pass_rush} shape is preserved exactly — baseline parity with {@link
 * MatchupPassResolver.PassMatchupShift#ZERO} remains a structural invariant.
 *
 * <p>Physical gap creates the window; skill delta moves within it. This is the math that rules out
 * an OL covering a 4.3 WR via maxed coverage skill: the floor rises with the offense's physical
 * advantage, preventing any defensive skill pool from dragging the matchup back below it.
 */
public final class ClampedPassMatchupShift implements MatchupPassResolver.PassMatchupShift {

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
