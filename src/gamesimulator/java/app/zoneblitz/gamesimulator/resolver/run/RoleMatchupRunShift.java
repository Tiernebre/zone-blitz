package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.resolver.RunRoles;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.role.DefensiveRoleAssignment;
import app.zoneblitz.gamesimulator.role.OffensiveRole;
import app.zoneblitz.gamesimulator.role.OffensiveRoleAssignment;
import app.zoneblitz.gamesimulator.role.RoleDemand;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.scheme.RoleDemandTable;
import java.util.function.ToDoubleFunction;

/**
 * Concept-aware, role-keyed run-matchup shift with physical-fit clamping. Aggregates per-(role,
 * player) demand scores from each scheme's {@link RoleDemandTable} into the three legacy buckets
 * (run blockers, ball carrier, run defenders), then runs the same physical-floor / physical-ceiling
 * clamp as before. Concept leg weights come from {@link RunConcept#blockingLegWeight()} / {@link
 * RunConcept#carrierLegWeight()}.
 *
 * <p>Formula per leg (blocking-leg and carrier-leg):
 *
 * <pre>
 *   physical_gap = off_physical_score(weights) − def_physical_score(weights)
 *   floor        = −1 + 0.5 × max(0, physical_gap)
 *   ceiling      = +1 + 0.5 × min(0, physical_gap)
 *   delta        = clamp(off_skill(weights) − def_skill(weights), floor, ceiling)
 * </pre>
 *
 * <p>The result is {@code blockingLegWeight × blockingDelta + carrierLegWeight × carrierDelta}.
 * Defenders sit on both legs intentionally — one pool handles block-defeat and downhill tackling.
 * {@code INSIDE_ZONE} reproduces the legacy shift exactly so baseline parity with {@link
 * MatchupRunResolver.RunMatchupShift#ZERO} is a structural invariant.
 */
public final class RoleMatchupRunShift implements MatchupRunResolver.RunMatchupShift {

  @Override
  public double compute(RunMatchupContext context, RandomSource rng) {
    var concept = context.concept();
    var offTable = context.offenseScheme().demandTable();
    var defTable = context.defenseScheme().demandTable();
    var offense = context.assignment().offense();
    var defense = context.assignment().defense();
    var carrier = context.roles().ballCarrier();

    var blockerSkill = aggregateBlockers(offense, offTable, concept, carrier, true);
    var blockerPhys = aggregateBlockers(offense, offTable, concept, carrier, false);
    var defenderSkill = aggregateDefense(defense, defTable, concept, true);
    var defenderPhys = aggregateDefense(defense, defTable, concept, false);

    var carrierSkill = scoreCarrier(carrier, offense, offTable, concept, true);
    var carrierPhys = scoreCarrier(carrier, offense, offTable, concept, false);

    var blocking = clampedDelta(blockerSkill, defenderSkill, blockerPhys, defenderPhys);
    var carrierDelta = clampedDelta(carrierSkill, defenderSkill, carrierPhys, defenderPhys);

    return concept.blockingLegWeight() * blocking + concept.carrierLegWeight() * carrierDelta;
  }

  private static double clampedDelta(
      double offSkill, double defSkill, double offPhys, double defPhys) {
    var gap = offPhys - defPhys;
    var floor = -1.0 + 0.5 * Math.max(0.0, gap);
    var ceiling = 1.0 + 0.5 * Math.min(0.0, gap);
    var raw = offSkill - defSkill;
    return Math.max(floor, Math.min(ceiling, raw));
  }

  private static double aggregateBlockers(
      OffensiveRoleAssignment assignment,
      RoleDemandTable table,
      RunConcept concept,
      java.util.Optional<Player> carrier,
      boolean skill) {
    var n = 0;
    var sum = 0.0;
    var carrierPlayer = carrier.orElse(null);
    for (var entry : assignment.players().entrySet()) {
      var role = entry.getKey();
      var player = entry.getValue();
      if (!RunRoles.isRunBlocker(role)) {
        continue;
      }
      if (player.equals(carrierPlayer)) {
        continue;
      }
      var demand = table.lookup(role, concept);
      sum += score(demand, player, skill);
      n++;
    }
    return n == 0 ? 0.0 : sum / n;
  }

  private static double aggregateDefense(
      DefensiveRoleAssignment assignment,
      RoleDemandTable table,
      RunConcept concept,
      boolean skill) {
    var n = 0;
    var sum = 0.0;
    for (var entry : assignment.players().entrySet()) {
      var role = entry.getKey();
      if (!RunRoles.isRunDefender(role)) {
        continue;
      }
      var demand = table.lookup(role, concept);
      sum += score(demand, entry.getValue(), skill);
      n++;
    }
    return n == 0 ? 0.0 : sum / n;
  }

  private static double scoreCarrier(
      java.util.Optional<Player> carrier,
      OffensiveRoleAssignment assignment,
      RoleDemandTable table,
      RunConcept concept,
      boolean skill) {
    if (carrier.isEmpty()) {
      return 0.0;
    }
    var player = carrier.get();
    var role = roleOf(assignment, player);
    if (role == null) {
      return 0.0;
    }
    var demand = table.lookup(role, concept);
    return score(demand, player, skill);
  }

  private static OffensiveRole roleOf(OffensiveRoleAssignment assignment, Player player) {
    for (var entry : assignment.players().entrySet()) {
      if (entry.getValue().equals(player)) {
        return entry.getKey();
      }
    }
    return null;
  }

  private static double score(RoleDemand demand, Player player, boolean skill) {
    ToDoubleFunction<Player> fn = skill ? demand::skillScore : demand::physicalScore;
    return fn.applyAsDouble(player);
  }
}
