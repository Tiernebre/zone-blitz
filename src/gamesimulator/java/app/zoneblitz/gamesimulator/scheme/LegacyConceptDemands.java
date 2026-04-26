package app.zoneblitz.gamesimulator.scheme;

import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.role.DefensiveRole;
import app.zoneblitz.gamesimulator.role.OffensiveRole;
import app.zoneblitz.gamesimulator.role.PhysicalAxis;
import app.zoneblitz.gamesimulator.role.RoleDemand;
import app.zoneblitz.gamesimulator.role.SkillAxis;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Single shared {@link RoleDemandTable} that encodes the legacy bucketed concept-profile data — the
 * {@code PassConceptProfiles} / {@code RunConceptProfiles} weights, exploded into per-(role,
 * concept) overrides. Every role in a given pass/run bucket gets the same {@link RoleDemand} for a
 * given concept, so the role-keyed shift's per-player aggregation reproduces the legacy
 * bucket-aggregate math exactly. Defaults stay empty — scouting still falls back to {@link
 * DefaultRoleDemands} for general scheme-fit scoring.
 *
 * <p>Currently shared by every scheme in {@link BuiltinSchemeCatalog}. Per-scheme variance is a
 * follow-up; today's data is scheme-agnostic, mirroring the legacy concept profiles.
 *
 * <p>Skill-axis weight rounding: the legacy aggregators like {@code (routeRunning + 2*hands) / 3}
 * become integer weight maps {@code (33, 67)} — sum-to-100 invariant on {@link RoleDemand} forces a
 * tiny rounding (33.33 → 33, 66.67 → 67). The drift is ≤ 2% per axis and well inside the
 * calibration tolerance bands.
 */
public final class LegacyConceptDemands {

  private LegacyConceptDemands() {}

  public static RoleDemandTable table() {
    return Holder.TABLE;
  }

  private static RoleDemandTable build() {
    var overrides = new HashMap<RoleDemandKey, RoleDemand>();
    populatePass(overrides);
    populateRun(overrides);
    return new RoleDemandTable(Map.of(), overrides);
  }

  // -------- pass --------

  private static final List<OffensiveRole> PASS_ROUTE_RUNNERS =
      List.of(
          OffensiveRole.X_WR,
          OffensiveRole.Z_WR,
          OffensiveRole.SLOT_WR,
          OffensiveRole.INLINE_TE,
          OffensiveRole.FLEX_TE,
          OffensiveRole.H_BACK,
          OffensiveRole.RB_RUSH,
          OffensiveRole.RB_RECEIVE,
          OffensiveRole.RB_PROTECT);

  private static final List<OffensiveRole> PASS_BLOCKERS =
      List.of(
          OffensiveRole.LT,
          OffensiveRole.LG,
          OffensiveRole.C,
          OffensiveRole.RG,
          OffensiveRole.RT,
          OffensiveRole.FB_LEAD);

  private static final List<DefensiveRole> PASS_RUSHERS =
      List.of(
          DefensiveRole.NOSE,
          DefensiveRole.THREE_TECH,
          DefensiveRole.FIVE_TECH,
          DefensiveRole.EDGE,
          DefensiveRole.STAND_UP_OLB);

  private static final List<DefensiveRole> COVERAGE_DEFENDERS =
      List.of(
          DefensiveRole.OUTSIDE_CB,
          DefensiveRole.SLOT_CB,
          DefensiveRole.DEEP_S,
          DefensiveRole.BOX_S,
          DefensiveRole.DIME_LB,
          DefensiveRole.MIKE_LB,
          DefensiveRole.WILL_LB,
          DefensiveRole.SAM_LB);

  private static void populatePass(Map<RoleDemandKey, RoleDemand> overrides) {
    var routeBaseline =
        demand(
            phys(35, 25, 20, 0, 0, 0, 0, 20),
            Map.of(SkillAxis.ROUTE_RUNNING, 50, SkillAxis.HANDS, 50));
    var protectionBaseline =
        demand(phys(0, 0, 20, 30, 30, 0, 20, 0), Map.of(SkillAxis.PASS_SET, 100));
    var coverageBaseline =
        demand(phys(35, 25, 25, 0, 0, 0, 0, 15), Map.of(SkillAxis.COVERAGE_TECHNIQUE, 100));
    var passRushBaseline =
        demand(
            phys(20, 0, 0, 25, 25, 15, 0, 15),
            Map.of(SkillAxis.PASS_RUSH_MOVES, 50, SkillAxis.BLOCK_SHEDDING, 50));

    var quickRoute =
        demand(
            phys(20, 30, 25, 0, 0, 0, 0, 25),
            Map.of(SkillAxis.ROUTE_RUNNING, 33, SkillAxis.HANDS, 67));
    var paRoute =
        demand(
            phys(45, 20, 15, 0, 0, 0, 0, 20),
            Map.of(SkillAxis.ROUTE_RUNNING, 50, SkillAxis.HANDS, 50));
    var paCoverage =
        demand(phys(45, 20, 20, 0, 0, 0, 0, 15), Map.of(SkillAxis.COVERAGE_TECHNIQUE, 100));
    var screenRoute =
        demand(
            phys(15, 30, 35, 0, 0, 0, 0, 20),
            Map.of(SkillAxis.ROUTE_RUNNING, 33, SkillAxis.HANDS, 67));
    var hmRoute = demand(phys(50, 0, 0, 0, 0, 0, 0, 50), Map.of(SkillAxis.HANDS, 100));
    var hmCoverage =
        demand(phys(50, 0, 0, 0, 0, 0, 0, 50), Map.of(SkillAxis.COVERAGE_TECHNIQUE, 100));

    var perConcept = new EnumMap<PassConcept, PassDemands>(PassConcept.class);
    perConcept.put(
        PassConcept.DROPBACK,
        new PassDemands(routeBaseline, protectionBaseline, coverageBaseline, passRushBaseline));
    perConcept.put(
        PassConcept.QUICK_GAME,
        new PassDemands(quickRoute, protectionBaseline, coverageBaseline, passRushBaseline));
    perConcept.put(
        PassConcept.PLAY_ACTION,
        new PassDemands(paRoute, protectionBaseline, paCoverage, passRushBaseline));
    perConcept.put(
        PassConcept.SCREEN,
        new PassDemands(screenRoute, protectionBaseline, coverageBaseline, passRushBaseline));
    perConcept.put(
        PassConcept.RPO,
        new PassDemands(routeBaseline, protectionBaseline, coverageBaseline, passRushBaseline));
    perConcept.put(
        PassConcept.HAIL_MARY,
        new PassDemands(hmRoute, protectionBaseline, hmCoverage, passRushBaseline));

    for (var entry : perConcept.entrySet()) {
      var concept = entry.getKey();
      var d = entry.getValue();
      stamp(overrides, PASS_ROUTE_RUNNERS, concept, d.route());
      stamp(overrides, PASS_BLOCKERS, concept, d.protection());
      stampDef(overrides, COVERAGE_DEFENDERS, concept, d.coverage());
      stampDef(overrides, PASS_RUSHERS, concept, d.passRush());
    }
  }

  private record PassDemands(
      RoleDemand route, RoleDemand protection, RoleDemand coverage, RoleDemand passRush) {}

  // -------- run --------

  private static final List<OffensiveRole> RUN_BLOCKERS =
      List.of(
          OffensiveRole.LT,
          OffensiveRole.LG,
          OffensiveRole.C,
          OffensiveRole.RG,
          OffensiveRole.RT,
          OffensiveRole.FB_LEAD,
          OffensiveRole.INLINE_TE,
          OffensiveRole.FLEX_TE,
          OffensiveRole.H_BACK);

  private static final List<OffensiveRole> RUN_CARRIER_CANDIDATES =
      List.of(OffensiveRole.RB_RUSH, OffensiveRole.FB_LEAD, OffensiveRole.QB_POCKET);

  private static final List<DefensiveRole> RUN_DEFENDERS =
      List.of(
          DefensiveRole.NOSE,
          DefensiveRole.THREE_TECH,
          DefensiveRole.FIVE_TECH,
          DefensiveRole.EDGE,
          DefensiveRole.STAND_UP_OLB,
          DefensiveRole.MIKE_LB,
          DefensiveRole.WILL_LB,
          DefensiveRole.SAM_LB,
          DefensiveRole.BOX_S,
          DefensiveRole.DIME_LB);

  private static void populateRun(Map<RoleDemandKey, RoleDemand> overrides) {
    var blockerBaseline =
        demand(phys(0, 0, 20, 30, 30, 0, 20, 0), Map.of(SkillAxis.RUN_BLOCK, 100));
    var carrierBaseline =
        demand(
            phys(25, 0, 25, 15, 15, 0, 0, 20),
            Map.of(SkillAxis.BALL_CARRIER_VISION, 50, SkillAxis.BREAK_TACKLE, 50));
    var defBaseline =
        demand(
            phys(20, 0, 20, 25, 20, 0, 0, 15),
            Map.of(SkillAxis.TACKLING, 50, SkillAxis.BLOCK_SHEDDING, 50));

    var powerBlockers = demand(phys(0, 0, 10, 40, 35, 0, 15, 0), Map.of(SkillAxis.RUN_BLOCK, 100));
    var powerCarrier =
        demand(
            phys(15, 0, 15, 25, 25, 0, 0, 20),
            Map.of(SkillAxis.BREAK_TACKLE, 67, SkillAxis.BALL_CARRIER_VISION, 33));
    var powerDef =
        demand(
            phys(10, 0, 15, 35, 25, 0, 0, 15),
            Map.of(SkillAxis.TACKLING, 67, SkillAxis.BLOCK_SHEDDING, 33));

    var counterBlockers =
        demand(phys(10, 0, 30, 25, 20, 0, 15, 0), Map.of(SkillAxis.RUN_BLOCK, 100));
    var counterCarrier =
        demand(
            phys(20, 0, 25, 15, 15, 0, 0, 25),
            Map.of(SkillAxis.BALL_CARRIER_VISION, 50, SkillAxis.BREAK_TACKLE, 50));
    var counterDef =
        demand(
            phys(15, 0, 25, 25, 15, 0, 0, 20),
            Map.of(SkillAxis.TACKLING, 33, SkillAxis.BLOCK_SHEDDING, 67));

    var stretchBlockers =
        demand(phys(20, 0, 35, 10, 10, 0, 25, 0), Map.of(SkillAxis.RUN_BLOCK, 100));
    var stretchCarrier =
        demand(
            phys(35, 0, 30, 5, 5, 0, 0, 25),
            Map.of(SkillAxis.BALL_CARRIER_VISION, 50, SkillAxis.BREAK_TACKLE, 50));
    var stretchDef =
        demand(
            phys(35, 0, 25, 10, 10, 0, 0, 20),
            Map.of(SkillAxis.TACKLING, 67, SkillAxis.BLOCK_SHEDDING, 33));

    var drawBlockers = demand(phys(10, 0, 25, 25, 20, 0, 20, 0), Map.of(SkillAxis.RUN_BLOCK, 100));
    var drawCarrier =
        demand(
            phys(25, 0, 25, 10, 15, 0, 0, 25),
            Map.of(SkillAxis.BALL_CARRIER_VISION, 50, SkillAxis.BREAK_TACKLE, 50));
    var drawDef =
        demand(
            phys(25, 0, 25, 15, 15, 0, 0, 20),
            Map.of(SkillAxis.TACKLING, 33, SkillAxis.BLOCK_SHEDDING, 67));

    var sneakBlockers = demand(phys(0, 0, 5, 45, 40, 0, 10, 0), Map.of(SkillAxis.RUN_BLOCK, 100));
    var sneakCarrier =
        demand(
            phys(5, 0, 5, 40, 40, 0, 0, 10),
            Map.of(SkillAxis.BREAK_TACKLE, 50, SkillAxis.BALL_CARRIER_VISION, 50));
    var sneakDef =
        demand(
            phys(0, 0, 5, 50, 35, 0, 0, 10),
            Map.of(SkillAxis.TACKLING, 67, SkillAxis.BLOCK_SHEDDING, 33));

    var perConcept = new EnumMap<RunConcept, RunDemands>(RunConcept.class);
    perConcept.put(
        RunConcept.INSIDE_ZONE, new RunDemands(blockerBaseline, carrierBaseline, defBaseline));
    perConcept.put(RunConcept.OTHER, new RunDemands(blockerBaseline, carrierBaseline, defBaseline));
    perConcept.put(RunConcept.POWER, new RunDemands(powerBlockers, powerCarrier, powerDef));
    perConcept.put(RunConcept.TRAP, new RunDemands(powerBlockers, powerCarrier, powerDef));
    perConcept.put(RunConcept.COUNTER, new RunDemands(counterBlockers, counterCarrier, counterDef));
    perConcept.put(
        RunConcept.OUTSIDE_ZONE, new RunDemands(stretchBlockers, stretchCarrier, stretchDef));
    perConcept.put(RunConcept.SWEEP, new RunDemands(stretchBlockers, stretchCarrier, stretchDef));
    perConcept.put(RunConcept.DRAW, new RunDemands(drawBlockers, drawCarrier, drawDef));
    perConcept.put(RunConcept.QB_DRAW, new RunDemands(drawBlockers, drawCarrier, drawDef));
    perConcept.put(RunConcept.QB_SNEAK, new RunDemands(sneakBlockers, sneakCarrier, sneakDef));

    for (var entry : perConcept.entrySet()) {
      var concept = entry.getKey();
      var d = entry.getValue();
      stamp(overrides, RUN_BLOCKERS, concept, d.blocker());
      stamp(overrides, RUN_CARRIER_CANDIDATES, concept, d.carrier());
      stampDef(overrides, RUN_DEFENDERS, concept, d.defender());
    }
  }

  private record RunDemands(RoleDemand blocker, RoleDemand carrier, RoleDemand defender) {}

  // -------- helpers --------

  private static void stamp(
      Map<RoleDemandKey, RoleDemand> overrides,
      List<OffensiveRole> roles,
      app.zoneblitz.gamesimulator.event.ConceptFamily concept,
      RoleDemand demand) {
    for (var role : roles) {
      overrides.put(new RoleDemandKey(role, concept), demand);
    }
  }

  private static void stampDef(
      Map<RoleDemandKey, RoleDemand> overrides,
      List<DefensiveRole> roles,
      app.zoneblitz.gamesimulator.event.ConceptFamily concept,
      RoleDemand demand) {
    for (var role : roles) {
      overrides.put(new RoleDemandKey(role, concept), demand);
    }
  }

  private static RoleDemand demand(
      Map<PhysicalAxis, Integer> physicalWeights, Map<SkillAxis, Integer> skillWeights) {
    return RoleDemand.of(physicalWeights, skillWeights);
  }

  private static Map<PhysicalAxis, Integer> phys(
      int speed,
      int acceleration,
      int agility,
      int strength,
      int power,
      int bend,
      int stamina,
      int explosiveness) {
    var map = new LinkedHashMap<PhysicalAxis, Integer>();
    putIfNonZero(map, PhysicalAxis.SPEED, speed);
    putIfNonZero(map, PhysicalAxis.ACCELERATION, acceleration);
    putIfNonZero(map, PhysicalAxis.AGILITY, agility);
    putIfNonZero(map, PhysicalAxis.STRENGTH, strength);
    putIfNonZero(map, PhysicalAxis.POWER, power);
    putIfNonZero(map, PhysicalAxis.BEND, bend);
    putIfNonZero(map, PhysicalAxis.STAMINA, stamina);
    putIfNonZero(map, PhysicalAxis.EXPLOSIVENESS, explosiveness);
    return map;
  }

  private static void putIfNonZero(Map<PhysicalAxis, Integer> map, PhysicalAxis axis, int value) {
    if (value != 0) {
      map.put(axis, value);
    }
  }

  private static final class Holder {
    private static final RoleDemandTable TABLE = build();
  }
}
