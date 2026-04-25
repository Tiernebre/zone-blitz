package app.zoneblitz.gamesimulator.scheme;

import app.zoneblitz.gamesimulator.role.OffensiveRole;
import app.zoneblitz.gamesimulator.role.PhysicalAxis;
import app.zoneblitz.gamesimulator.role.Role;
import app.zoneblitz.gamesimulator.role.RoleDemand;
import app.zoneblitz.gamesimulator.role.SkillAxis;
import app.zoneblitz.gamesimulator.role.TendencyAxis;
import java.util.Map;

/** Builds the offensive half of {@link DefaultRoleDemands}. */
final class OffensiveRoleDemands {

  private OffensiveRoleDemands() {}

  static void contributeTo(Map<Role, RoleDemand> map) {
    map.put(
        OffensiveRole.QB_POCKET,
        new RoleDemand(
            Map.of(PhysicalAxis.AGILITY, 40, PhysicalAxis.STRENGTH, 30, PhysicalAxis.STAMINA, 30),
            Map.of(),
            Map.of(
                TendencyAxis.PROCESSING, 35,
                TendencyAxis.FOOTBALL_IQ, 30,
                TendencyAxis.COMPOSURE, 20,
                TendencyAxis.CLUTCH, 15)));

    map.put(
        OffensiveRole.QB_MOVEMENT,
        new RoleDemand(
            Map.of(
                PhysicalAxis.SPEED, 30,
                PhysicalAxis.ACCELERATION, 25,
                PhysicalAxis.AGILITY, 25,
                PhysicalAxis.EXPLOSIVENESS, 20),
            Map.of(),
            Map.of(
                TendencyAxis.PROCESSING, 35,
                TendencyAxis.COMPOSURE, 25,
                TendencyAxis.FOOTBALL_IQ, 20,
                TendencyAxis.CLUTCH, 20)));

    map.put(
        OffensiveRole.X_WR,
        new RoleDemand(
            Map.of(
                PhysicalAxis.SPEED, 35,
                PhysicalAxis.ACCELERATION, 25,
                PhysicalAxis.STRENGTH, 20,
                PhysicalAxis.EXPLOSIVENESS, 20),
            Map.of(SkillAxis.ROUTE_RUNNING, 50, SkillAxis.HANDS, 35, SkillAxis.BREAK_TACKLE, 15),
            Map.of(
                TendencyAxis.COMPOSURE, 40,
                TendencyAxis.FOOTBALL_IQ, 30,
                TendencyAxis.CONSISTENCY, 30)));

    map.put(
        OffensiveRole.Z_WR,
        new RoleDemand(
            Map.of(
                PhysicalAxis.SPEED, 30,
                PhysicalAxis.ACCELERATION, 25,
                PhysicalAxis.AGILITY, 20,
                PhysicalAxis.EXPLOSIVENESS, 25),
            Map.of(SkillAxis.ROUTE_RUNNING, 50, SkillAxis.HANDS, 35, SkillAxis.BREAK_TACKLE, 15),
            Map.of(
                TendencyAxis.COMPOSURE, 35,
                TendencyAxis.FOOTBALL_IQ, 35,
                TendencyAxis.CONSISTENCY, 30)));

    map.put(
        OffensiveRole.SLOT_WR,
        new RoleDemand(
            Map.of(
                PhysicalAxis.AGILITY, 35,
                PhysicalAxis.ACCELERATION, 25,
                PhysicalAxis.SPEED, 20,
                PhysicalAxis.BEND, 20),
            Map.of(SkillAxis.ROUTE_RUNNING, 45, SkillAxis.HANDS, 40, SkillAxis.BREAK_TACKLE, 15),
            Map.of(
                TendencyAxis.PROCESSING, 35,
                TendencyAxis.FOOTBALL_IQ, 35,
                TendencyAxis.COMPOSURE, 30)));

    map.put(
        OffensiveRole.INLINE_TE,
        new RoleDemand(
            Map.of(
                PhysicalAxis.STRENGTH, 30,
                PhysicalAxis.POWER, 25,
                PhysicalAxis.SPEED, 15,
                PhysicalAxis.STAMINA, 15,
                PhysicalAxis.ACCELERATION, 15),
            Map.of(
                SkillAxis.RUN_BLOCK, 45,
                SkillAxis.BLOCK_SHEDDING, 25,
                SkillAxis.HANDS, 20,
                SkillAxis.ROUTE_RUNNING, 10),
            Map.of(
                TendencyAxis.TOUGHNESS, 45,
                TendencyAxis.MOTOR, 30,
                TendencyAxis.DISCIPLINE, 25)));

    map.put(
        OffensiveRole.FLEX_TE,
        new RoleDemand(
            Map.of(
                PhysicalAxis.SPEED, 25,
                PhysicalAxis.ACCELERATION, 20,
                PhysicalAxis.AGILITY, 25,
                PhysicalAxis.EXPLOSIVENESS, 15,
                PhysicalAxis.STRENGTH, 15),
            Map.of(
                SkillAxis.ROUTE_RUNNING, 45,
                SkillAxis.HANDS, 35,
                SkillAxis.RUN_BLOCK, 10,
                SkillAxis.BREAK_TACKLE, 10),
            Map.of(
                TendencyAxis.FOOTBALL_IQ, 40,
                TendencyAxis.COMPOSURE, 30,
                TendencyAxis.PROCESSING, 30)));

    map.put(
        OffensiveRole.H_BACK,
        new RoleDemand(
            Map.of(
                PhysicalAxis.STRENGTH, 25,
                PhysicalAxis.POWER, 20,
                PhysicalAxis.SPEED, 20,
                PhysicalAxis.AGILITY, 20,
                PhysicalAxis.STAMINA, 15),
            Map.of(
                SkillAxis.RUN_BLOCK, 35,
                SkillAxis.BLOCK_SHEDDING, 20,
                SkillAxis.HANDS, 25,
                SkillAxis.ROUTE_RUNNING, 20),
            Map.of(
                TendencyAxis.MOTOR, 40,
                TendencyAxis.TOUGHNESS, 35,
                TendencyAxis.FOOTBALL_IQ, 25)));

    map.put(
        OffensiveRole.RB_RUSH,
        new RoleDemand(
            Map.of(
                PhysicalAxis.SPEED, 25,
                PhysicalAxis.ACCELERATION, 25,
                PhysicalAxis.STRENGTH, 20,
                PhysicalAxis.POWER, 15,
                PhysicalAxis.EXPLOSIVENESS, 15),
            Map.of(
                SkillAxis.BALL_CARRIER_VISION, 40,
                SkillAxis.BREAK_TACKLE, 35,
                SkillAxis.HANDS, 15,
                SkillAxis.ROUTE_RUNNING, 10),
            Map.of(
                TendencyAxis.TOUGHNESS, 40,
                TendencyAxis.MOTOR, 30,
                TendencyAxis.FOOTBALL_IQ, 30)));

    map.put(
        OffensiveRole.RB_RECEIVE,
        new RoleDemand(
            Map.of(
                PhysicalAxis.SPEED, 25,
                PhysicalAxis.ACCELERATION, 25,
                PhysicalAxis.AGILITY, 25,
                PhysicalAxis.EXPLOSIVENESS, 15,
                PhysicalAxis.BEND, 10),
            Map.of(
                SkillAxis.HANDS, 35,
                SkillAxis.ROUTE_RUNNING, 30,
                SkillAxis.BREAK_TACKLE, 20,
                SkillAxis.BALL_CARRIER_VISION, 15),
            Map.of(
                TendencyAxis.PROCESSING, 35,
                TendencyAxis.FOOTBALL_IQ, 35,
                TendencyAxis.COMPOSURE, 30)));

    map.put(
        OffensiveRole.RB_PROTECT,
        new RoleDemand(
            Map.of(
                PhysicalAxis.STRENGTH, 35,
                PhysicalAxis.POWER, 25,
                PhysicalAxis.AGILITY, 20,
                PhysicalAxis.STAMINA, 20),
            Map.of(
                SkillAxis.PASS_SET, 35,
                SkillAxis.RUN_BLOCK, 30,
                SkillAxis.BLOCK_SHEDDING, 20,
                SkillAxis.BREAK_TACKLE, 15),
            Map.of(
                TendencyAxis.TOUGHNESS, 40,
                TendencyAxis.PROCESSING, 30,
                TendencyAxis.MOTOR, 30)));

    map.put(
        OffensiveRole.FB_LEAD,
        new RoleDemand(
            Map.of(
                PhysicalAxis.STRENGTH, 35,
                PhysicalAxis.POWER, 30,
                PhysicalAxis.SPEED, 20,
                PhysicalAxis.STAMINA, 15),
            Map.of(
                SkillAxis.RUN_BLOCK, 50, SkillAxis.BLOCK_SHEDDING, 25, SkillAxis.BREAK_TACKLE, 25),
            Map.of(
                TendencyAxis.TOUGHNESS, 50,
                TendencyAxis.MOTOR, 30,
                TendencyAxis.DISCIPLINE, 20)));

    addOlRole(map, OffensiveRole.LT, 35, 25);
    addOlRole(map, OffensiveRole.LG, 30, 30);
    addOlRole(map, OffensiveRole.C, 25, 30);
    addOlRole(map, OffensiveRole.RG, 30, 30);
    addOlRole(map, OffensiveRole.RT, 35, 25);
  }

  private static void addOlRole(
      Map<Role, RoleDemand> map, OffensiveRole role, int passSet, int runBlock) {
    map.put(
        role,
        new RoleDemand(
            Map.of(
                PhysicalAxis.STRENGTH, 25,
                PhysicalAxis.POWER, 35,
                PhysicalAxis.AGILITY, 30,
                PhysicalAxis.STAMINA, 10),
            Map.of(
                SkillAxis.PASS_SET, passSet,
                SkillAxis.RUN_BLOCK, runBlock,
                SkillAxis.BLOCK_SHEDDING, 100 - passSet - runBlock),
            Map.of(
                TendencyAxis.TOUGHNESS, 40,
                TendencyAxis.DISCIPLINE, 30,
                TendencyAxis.MOTOR, 30)));
  }
}
