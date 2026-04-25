package app.zoneblitz.gamesimulator.scheme;

import app.zoneblitz.gamesimulator.role.DefensiveRole;
import app.zoneblitz.gamesimulator.role.PhysicalAxis;
import app.zoneblitz.gamesimulator.role.Role;
import app.zoneblitz.gamesimulator.role.RoleDemand;
import app.zoneblitz.gamesimulator.role.SkillAxis;
import app.zoneblitz.gamesimulator.role.TendencyAxis;
import java.util.Map;

/** Builds the defensive half of {@link DefaultRoleDemands}. */
final class DefensiveRoleDemands {

  private DefensiveRoleDemands() {}

  static void contributeTo(Map<Role, RoleDemand> map) {
    map.put(
        DefensiveRole.DEEP_S,
        new RoleDemand(
            Map.of(
                PhysicalAxis.SPEED, 30,
                PhysicalAxis.ACCELERATION, 20,
                PhysicalAxis.AGILITY, 20,
                PhysicalAxis.BEND, 20,
                PhysicalAxis.EXPLOSIVENESS, 10),
            Map.of(
                SkillAxis.COVERAGE_TECHNIQUE, 60,
                SkillAxis.HANDS, 25,
                SkillAxis.TACKLING, 15),
            Map.of(TendencyAxis.FOOTBALL_IQ, 50, TendencyAxis.PROCESSING, 50)));

    map.put(
        DefensiveRole.BOX_S,
        new RoleDemand(
            Map.of(
                PhysicalAxis.STRENGTH, 30,
                PhysicalAxis.POWER, 25,
                PhysicalAxis.SPEED, 15,
                PhysicalAxis.ACCELERATION, 15,
                PhysicalAxis.EXPLOSIVENESS, 15),
            Map.of(
                SkillAxis.TACKLING, 50,
                SkillAxis.BLOCK_SHEDDING, 30,
                SkillAxis.PASS_RUSH_MOVES, 20),
            Map.of(
                TendencyAxis.TOUGHNESS, 40,
                TendencyAxis.MOTOR, 30,
                TendencyAxis.FOOTBALL_IQ, 30)));

    map.put(
        DefensiveRole.OUTSIDE_CB,
        new RoleDemand(
            Map.of(
                PhysicalAxis.SPEED, 35,
                PhysicalAxis.ACCELERATION, 25,
                PhysicalAxis.AGILITY, 15,
                PhysicalAxis.BEND, 15,
                PhysicalAxis.EXPLOSIVENESS, 10),
            Map.of(
                SkillAxis.COVERAGE_TECHNIQUE, 60,
                SkillAxis.HANDS, 25,
                SkillAxis.TACKLING, 15),
            Map.of(
                TendencyAxis.FOOTBALL_IQ, 40,
                TendencyAxis.COMPOSURE, 30,
                TendencyAxis.PROCESSING, 30)));

    map.put(
        DefensiveRole.SLOT_CB,
        new RoleDemand(
            Map.of(
                PhysicalAxis.AGILITY, 30,
                PhysicalAxis.ACCELERATION, 25,
                PhysicalAxis.SPEED, 20,
                PhysicalAxis.BEND, 15,
                PhysicalAxis.EXPLOSIVENESS, 10),
            Map.of(
                SkillAxis.COVERAGE_TECHNIQUE, 50,
                SkillAxis.HANDS, 20,
                SkillAxis.TACKLING, 30),
            Map.of(
                TendencyAxis.PROCESSING, 40,
                TendencyAxis.FOOTBALL_IQ, 35,
                TendencyAxis.COMPOSURE, 25)));

    map.put(
        DefensiveRole.NOSE,
        new RoleDemand(
            Map.of(PhysicalAxis.STRENGTH, 40, PhysicalAxis.POWER, 35, PhysicalAxis.STAMINA, 25),
            Map.of(
                SkillAxis.BLOCK_SHEDDING, 55,
                SkillAxis.TACKLING, 30,
                SkillAxis.PASS_RUSH_MOVES, 15),
            Map.of(
                TendencyAxis.TOUGHNESS, 50,
                TendencyAxis.MOTOR, 30,
                TendencyAxis.DISCIPLINE, 20)));

    map.put(
        DefensiveRole.THREE_TECH,
        new RoleDemand(
            Map.of(
                PhysicalAxis.STRENGTH, 25,
                PhysicalAxis.POWER, 25,
                PhysicalAxis.EXPLOSIVENESS, 25,
                PhysicalAxis.AGILITY, 15,
                PhysicalAxis.BEND, 10),
            Map.of(
                SkillAxis.PASS_RUSH_MOVES, 45,
                SkillAxis.BLOCK_SHEDDING, 35,
                SkillAxis.TACKLING, 20),
            Map.of(
                TendencyAxis.MOTOR, 50,
                TendencyAxis.TOUGHNESS, 30,
                TendencyAxis.DISCIPLINE, 20)));

    map.put(
        DefensiveRole.FIVE_TECH,
        new RoleDemand(
            Map.of(
                PhysicalAxis.STRENGTH, 30,
                PhysicalAxis.POWER, 25,
                PhysicalAxis.SPEED, 15,
                PhysicalAxis.AGILITY, 15,
                PhysicalAxis.BEND, 15),
            Map.of(
                SkillAxis.BLOCK_SHEDDING, 45,
                SkillAxis.PASS_RUSH_MOVES, 35,
                SkillAxis.TACKLING, 20),
            Map.of(
                TendencyAxis.MOTOR, 50,
                TendencyAxis.DISCIPLINE, 30,
                TendencyAxis.TOUGHNESS, 20)));

    map.put(
        DefensiveRole.EDGE,
        new RoleDemand(
            Map.of(
                PhysicalAxis.SPEED, 25,
                PhysicalAxis.ACCELERATION, 20,
                PhysicalAxis.BEND, 25,
                PhysicalAxis.EXPLOSIVENESS, 20,
                PhysicalAxis.AGILITY, 10),
            Map.of(
                SkillAxis.PASS_RUSH_MOVES, 60,
                SkillAxis.BLOCK_SHEDDING, 25,
                SkillAxis.TACKLING, 15),
            Map.of(
                TendencyAxis.MOTOR, 60,
                TendencyAxis.TOUGHNESS, 25,
                TendencyAxis.PROCESSING, 15)));

    map.put(
        DefensiveRole.STAND_UP_OLB,
        new RoleDemand(
            Map.of(
                PhysicalAxis.SPEED, 25,
                PhysicalAxis.ACCELERATION, 20,
                PhysicalAxis.AGILITY, 20,
                PhysicalAxis.BEND, 20,
                PhysicalAxis.EXPLOSIVENESS, 15),
            Map.of(
                SkillAxis.PASS_RUSH_MOVES, 55,
                SkillAxis.BLOCK_SHEDDING, 25,
                SkillAxis.TACKLING, 20),
            Map.of(
                TendencyAxis.MOTOR, 50,
                TendencyAxis.PROCESSING, 30,
                TendencyAxis.TOUGHNESS, 20)));

    map.put(
        DefensiveRole.MIKE_LB,
        new RoleDemand(
            Map.of(
                PhysicalAxis.STRENGTH, 25,
                PhysicalAxis.SPEED, 20,
                PhysicalAxis.POWER, 20,
                PhysicalAxis.ACCELERATION, 20,
                PhysicalAxis.STAMINA, 15),
            Map.of(
                SkillAxis.TACKLING, 45,
                SkillAxis.BLOCK_SHEDDING, 30,
                SkillAxis.COVERAGE_TECHNIQUE, 25),
            Map.of(
                TendencyAxis.FOOTBALL_IQ, 50,
                TendencyAxis.PROCESSING, 30,
                TendencyAxis.MOTOR, 20)));

    map.put(
        DefensiveRole.WILL_LB,
        new RoleDemand(
            Map.of(
                PhysicalAxis.SPEED, 30,
                PhysicalAxis.AGILITY, 25,
                PhysicalAxis.ACCELERATION, 20,
                PhysicalAxis.BEND, 15,
                PhysicalAxis.EXPLOSIVENESS, 10),
            Map.of(
                SkillAxis.COVERAGE_TECHNIQUE, 35,
                SkillAxis.TACKLING, 35,
                SkillAxis.BLOCK_SHEDDING, 30),
            Map.of(
                TendencyAxis.PROCESSING, 40,
                TendencyAxis.FOOTBALL_IQ, 35,
                TendencyAxis.MOTOR, 25)));

    map.put(
        DefensiveRole.SAM_LB,
        new RoleDemand(
            Map.of(
                PhysicalAxis.STRENGTH, 25,
                PhysicalAxis.POWER, 20,
                PhysicalAxis.SPEED, 20,
                PhysicalAxis.ACCELERATION, 20,
                PhysicalAxis.AGILITY, 15),
            Map.of(
                SkillAxis.TACKLING, 40,
                SkillAxis.BLOCK_SHEDDING, 35,
                SkillAxis.PASS_RUSH_MOVES, 25),
            Map.of(
                TendencyAxis.TOUGHNESS, 40,
                TendencyAxis.MOTOR, 30,
                TendencyAxis.PROCESSING, 30)));

    map.put(
        DefensiveRole.DIME_LB,
        new RoleDemand(
            Map.of(
                PhysicalAxis.SPEED, 30,
                PhysicalAxis.AGILITY, 25,
                PhysicalAxis.ACCELERATION, 20,
                PhysicalAxis.BEND, 15,
                PhysicalAxis.EXPLOSIVENESS, 10),
            Map.of(
                SkillAxis.COVERAGE_TECHNIQUE, 50,
                SkillAxis.TACKLING, 30,
                SkillAxis.HANDS, 20),
            Map.of(
                TendencyAxis.PROCESSING, 40,
                TendencyAxis.FOOTBALL_IQ, 40,
                TendencyAxis.COMPOSURE, 20)));
  }
}
