package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.resolver.PassRoles;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.role.DefensiveRole;
import app.zoneblitz.gamesimulator.role.DefensiveRoleAssignment;
import app.zoneblitz.gamesimulator.role.OffensiveRole;
import app.zoneblitz.gamesimulator.role.OffensiveRoleAssignment;
import app.zoneblitz.gamesimulator.role.RoleDemand;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.scheme.RoleDemandTable;
import java.util.function.ToDoubleFunction;

/**
 * Concept-aware, role-keyed pass-matchup shift with physical-fit clamping. Aggregates per-(role,
 * player) demand scores from each scheme's {@link RoleDemandTable} into the four legacy buckets
 * (route runners, coverage defenders, pass rushers, pass blockers), then runs the same
 * physical-floor / physical-ceiling clamp as before. Concept leg weights come from {@link
 * PassConcept#coverageLegWeight()} / {@link PassConcept#passRushLegWeight()}.
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
    var concept = context.concept();
    var offTable = context.offenseScheme().demandTable();
    var defTable = context.defenseScheme().demandTable();
    var offense = context.assignment().offense();
    var defense = context.assignment().defense();

    var routeSkill = aggregateOffense(offense, offTable, concept, PassRoles::isRouteRunner, true);
    var routePhys = aggregateOffense(offense, offTable, concept, PassRoles::isRouteRunner, false);
    var coverageSkill =
        aggregateDefense(defense, defTable, concept, PassRoles::isCoverageDefender, true);
    var coveragePhys =
        aggregateDefense(defense, defTable, concept, PassRoles::isCoverageDefender, false);

    var protSkill = aggregateOffense(offense, offTable, concept, PassRoles::isPassBlocker, true);
    var protPhys = aggregateOffense(offense, offTable, concept, PassRoles::isPassBlocker, false);
    var rushSkill = aggregateDefense(defense, defTable, concept, PassRoles::isPassRusher, true);
    var rushPhys = aggregateDefense(defense, defTable, concept, PassRoles::isPassRusher, false);

    var coverage = clampedDelta(routeSkill, coverageSkill, routePhys, coveragePhys);
    var passRush = clampedDelta(rushSkill, protSkill, rushPhys, protPhys);

    return concept.coverageLegWeight() * coverage - concept.passRushLegWeight() * passRush;
  }

  private static double clampedDelta(
      double offSkill, double defSkill, double offPhys, double defPhys) {
    var gap = offPhys - defPhys;
    var floor = -1.0 + 0.5 * Math.max(0.0, gap);
    var ceiling = 1.0 + 0.5 * Math.min(0.0, gap);
    var raw = offSkill - defSkill;
    return Math.max(floor, Math.min(ceiling, raw));
  }

  private static double aggregateOffense(
      OffensiveRoleAssignment assignment,
      RoleDemandTable table,
      PassConcept concept,
      java.util.function.Predicate<OffensiveRole> bucket,
      boolean skill) {
    var n = 0;
    var sum = 0.0;
    for (var entry : assignment.players().entrySet()) {
      if (!bucket.test(entry.getKey())) {
        continue;
      }
      var demand = table.lookup(entry.getKey(), concept);
      sum += score(demand, entry.getValue(), skill);
      n++;
    }
    return n == 0 ? 0.0 : sum / n;
  }

  private static double aggregateDefense(
      DefensiveRoleAssignment assignment,
      RoleDemandTable table,
      PassConcept concept,
      java.util.function.Predicate<DefensiveRole> bucket,
      boolean skill) {
    var n = 0;
    var sum = 0.0;
    for (var entry : assignment.players().entrySet()) {
      if (!bucket.test(entry.getKey())) {
        continue;
      }
      var demand = table.lookup(entry.getKey(), concept);
      sum += score(demand, entry.getValue(), skill);
      n++;
    }
    return n == 0 ? 0.0 : sum / n;
  }

  private static double score(RoleDemand demand, Player player, boolean skill) {
    ToDoubleFunction<Player> fn = skill ? demand::skillScore : demand::physicalScore;
    return fn.applyAsDouble(player);
  }
}
