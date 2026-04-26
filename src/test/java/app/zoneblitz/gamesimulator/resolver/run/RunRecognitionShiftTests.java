package app.zoneblitz.gamesimulator.resolver.run;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.resolver.MatchupContextDefaults;
import app.zoneblitz.gamesimulator.resolver.RunRoles;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.role.DefensiveRole;
import app.zoneblitz.gamesimulator.role.DefensiveRoleAssignment;
import app.zoneblitz.gamesimulator.role.OffensiveRole;
import app.zoneblitz.gamesimulator.role.OffensiveRoleAssignment;
import app.zoneblitz.gamesimulator.role.RoleAssignmentPair;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RunRecognitionShiftTests {

  private static RunMatchupContext ctxWith(RoleAssignmentPair assignment) {
    return ctxWith(assignment, Optional.empty());
  }

  private static RunMatchupContext ctxWith(
      RoleAssignmentPair assignment, Optional<Player> carrier) {
    return new RunMatchupContext(
        RunConcept.INSIDE_ZONE,
        new RunRoles(carrier, List.of(), List.of()),
        OffensiveFormation.SINGLEBACK,
        50,
        10,
        MatchupContextDefaults.OFFENSE,
        MatchupContextDefaults.DEFENSE,
        assignment);
  }

  @Test
  void compute_emptyAssignment_returnsZero() {
    var shift = new RunRecognitionShift();

    var result =
        shift.compute(
            ctxWith(MatchupContextDefaults.EMPTY_ASSIGNMENT), new SplittableRandomSource(0L));

    assertThat(result).isZero();
  }

  @Test
  void compute_averageAttributes_returnsZero() {
    var shift = new RunRecognitionShift();

    var result = shift.compute(ctxWith(averageAssignment()), new SplittableRandomSource(0L));

    assertThat(result).isZero();
  }

  @Test
  void compute_eliteRecognition_averageCarrier_returnsNegative() {
    var shift = new RunRecognitionShift();
    var assignment = assignmentWith(elite2ndLevelDefense(), averageOffense());
    var carrier = assignment.offense().players().get(OffensiveRole.RB_RUSH);

    var result =
        shift.compute(ctxWith(assignment, Optional.of(carrier)), new SplittableRandomSource(0L));

    assertThat(result)
        .as("a defense full of sharp run-fit reads tilts the matchup against the offense")
        .isNegative();
    assertThat(result)
        .as("magnitude is bounded by ENVELOPE so it stacks under role-keyed talent")
        .isGreaterThanOrEqualTo(-RunRecognitionShift.ENVELOPE);
  }

  @Test
  void compute_eliteRecognition_eliteCarrier_offsetsRecognitionPenalty() {
    var shift = new RunRecognitionShift();
    var avgOff = averageOffense();
    var avgAssignment = assignmentWith(elite2ndLevelDefense(), avgOff);
    var avgCarrier = avgOff.get(OffensiveRole.RB_RUSH);
    var defenseOnly =
        shift.compute(
            ctxWith(avgAssignment, Optional.of(avgCarrier)), new SplittableRandomSource(0L));

    var eliteOff = offenseWithCarrier(rb(0, 100, 100));
    var eliteAssignment = assignmentWith(elite2ndLevelDefense(), eliteOff);
    var eliteCarrier = eliteOff.get(OffensiveRole.RB_RUSH);
    var bothElite =
        shift.compute(
            ctxWith(eliteAssignment, Optional.of(eliteCarrier)), new SplittableRandomSource(0L));

    assertThat(bothElite)
        .as("a great RB's vision/elusiveness blunts a great defense's recognition advantage")
        .isGreaterThan(defenseOnly);
    assertThat(bothElite)
        .as("recognition still wins on net — defense advantage is reduced, not erased")
        .isNegative();
  }

  @Test
  void compute_averageDefense_eliteCarrier_returnsPositive() {
    var shift = new RunRecognitionShift();
    var off = offenseWithCarrier(rb(0, 100, 100));
    var assignment = assignmentWith(average2ndLevelDefense(), off);
    var carrier = off.get(OffensiveRole.RB_RUSH);

    var result =
        shift.compute(ctxWith(assignment, Optional.of(carrier)), new SplittableRandomSource(0L));

    assertThat(result)
        .as("an elite vision/elusiveness back vs an average defense lifts the matchup slightly")
        .isPositive();
  }

  private static RoleAssignmentPair averageAssignment() {
    return assignmentWith(average2ndLevelDefense(), averageOffense());
  }

  private static RoleAssignmentPair assignmentWith(
      Map<DefensiveRole, Player> defense, Map<OffensiveRole, Player> offense) {
    return new RoleAssignmentPair(
        new OffensiveRoleAssignment(offense), new DefensiveRoleAssignment(defense));
  }

  private static Map<OffensiveRole, Player> averageOffense() {
    return offenseWithCarrier(rb(0, 50, 50));
  }

  private static Map<OffensiveRole, Player> offenseWithCarrier(Player carrier) {
    var off = new EnumMap<OffensiveRole, Player>(OffensiveRole.class);
    off.put(OffensiveRole.RB_RUSH, carrier);
    return off;
  }

  private static Map<DefensiveRole, Player> average2ndLevelDefense() {
    var def = new EnumMap<DefensiveRole, Player>(DefensiveRole.class);
    def.put(DefensiveRole.MIKE_LB, lb(11, 50));
    def.put(DefensiveRole.WILL_LB, lb(12, 50));
    def.put(DefensiveRole.SAM_LB, lb(13, 50));
    def.put(DefensiveRole.BOX_S, safety(14, 50));
    def.put(DefensiveRole.DEEP_S, safety(15, 50));
    return def;
  }

  private static Map<DefensiveRole, Player> elite2ndLevelDefense() {
    var def = new EnumMap<DefensiveRole, Player>(DefensiveRole.class);
    def.put(DefensiveRole.MIKE_LB, lb(11, 100));
    def.put(DefensiveRole.WILL_LB, lb(12, 100));
    def.put(DefensiveRole.SAM_LB, lb(13, 100));
    def.put(DefensiveRole.BOX_S, safety(14, 100));
    def.put(DefensiveRole.DEEP_S, safety(15, 100));
    return def;
  }

  private static Player rb(int seed, int vision, int breakTackle) {
    return new Player(
        new PlayerId(new UUID(0L, seed)),
        Position.RB,
        "RB-" + seed,
        Physical.average(),
        new Skill(
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            vision,
            breakTackle,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50),
        Tendencies.average());
  }

  private static Player lb(int seed, int playRecognition) {
    return new Player(
        new PlayerId(new UUID(0L, seed)),
        Position.LB,
        "LB-" + seed,
        Physical.average(),
        Skill.average(),
        new Tendencies(50, 50, 50, 50, 50, 50, 50, 50, playRecognition));
  }

  private static Player safety(int seed, int playRecognition) {
    return new Player(
        new PlayerId(new UUID(0L, seed)),
        Position.S,
        "S-" + seed,
        Physical.average(),
        Skill.average(),
        new Tendencies(50, 50, 50, 50, 50, 50, 50, 50, playRecognition));
  }
}
