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

class GoalLineRunShiftTests {

  private static final RunRoles EMPTY_ROLES = new RunRoles(Optional.empty(), List.of(), List.of());

  private static RunMatchupContext ctxAt(int yardLine, int yardsToGo, RunConcept concept) {
    return new RunMatchupContext(
        concept,
        EMPTY_ROLES,
        OffensiveFormation.SINGLEBACK,
        yardLine,
        yardsToGo,
        MatchupContextDefaults.OFFENSE,
        MatchupContextDefaults.DEFENSE,
        MatchupContextDefaults.BASELINE_OFFENSE,
        MatchupContextDefaults.EMPTY_ASSIGNMENT);
  }

  @Test
  void compute_outsideRedZone_returnsZero() {
    var shift = new GoalLineRunShift();

    assertThat(shift.compute(ctxAt(50, 10, RunConcept.INSIDE_ZONE), new SplittableRandomSource(0L)))
        .isZero();
    assertThat(shift.compute(ctxAt(89, 10, RunConcept.INSIDE_ZONE), new SplittableRandomSource(0L)))
        .isZero();
  }

  @Test
  void compute_atTheOne_returnsStrongNegative() {
    var shift = new GoalLineRunShift();

    var result =
        shift.compute(ctxAt(99, 10, RunConcept.INSIDE_ZONE), new SplittableRandomSource(0L));

    assertThat(result).isCloseTo(-2.0, org.assertj.core.data.Offset.offset(1e-12));
  }

  @Test
  void compute_atTheFive_returnsModerateNegative() {
    var shift = new GoalLineRunShift();

    var result =
        shift.compute(ctxAt(95, 10, RunConcept.INSIDE_ZONE), new SplittableRandomSource(0L));

    assertThat(result).isCloseTo(-1.2, org.assertj.core.data.Offset.offset(1e-12));
  }

  @Test
  void compute_atTheTen_returnsSmallNegative() {
    var shift = new GoalLineRunShift();

    var result =
        shift.compute(ctxAt(90, 10, RunConcept.INSIDE_ZONE), new SplittableRandomSource(0L));

    assertThat(result).isCloseTo(-0.2, org.assertj.core.data.Offset.offset(1e-12));
  }

  @Test
  void compute_shortYardagePowerOrSneak_partiallyOffsetsRedZone() {
    var shift = new GoalLineRunShift();

    var power = shift.compute(ctxAt(99, 1, RunConcept.POWER), new SplittableRandomSource(0L));
    var sneak = shift.compute(ctxAt(99, 1, RunConcept.QB_SNEAK), new SplittableRandomSource(0L));
    var baseline =
        shift.compute(ctxAt(99, 1, RunConcept.INSIDE_ZONE), new SplittableRandomSource(0L));

    var offset = org.assertj.core.data.Offset.offset(1e-12);
    assertThat(power).isCloseTo(-1.6, offset);
    assertThat(sneak).isCloseTo(-1.6, offset);
    assertThat(baseline).isCloseTo(-2.0, offset);
  }

  @Test
  void compute_longerDistancePower_insideRedZone_noConceptBonus() {
    var shift = new GoalLineRunShift();

    var result = shift.compute(ctxAt(99, 5, RunConcept.POWER), new SplittableRandomSource(0L));

    assertThat(result).isCloseTo(-2.0, org.assertj.core.data.Offset.offset(1e-12));
  }

  @Test
  void compute_shortYardageNonPowerConcept_noBonus() {
    var shift = new GoalLineRunShift();

    var inside =
        shift.compute(ctxAt(99, 1, RunConcept.INSIDE_ZONE), new SplittableRandomSource(0L));
    var outside =
        shift.compute(ctxAt(99, 1, RunConcept.OUTSIDE_ZONE), new SplittableRandomSource(0L));

    var offset = org.assertj.core.data.Offset.offset(1e-12);
    assertThat(inside).isCloseTo(-2.0, offset);
    assertThat(outside).isCloseTo(-2.0, offset);
  }

  @Test
  void compute_doesNotConsumeRng() {
    var shift = new GoalLineRunShift();
    var parent = new SplittableRandomSource(42L);
    var twin = new SplittableRandomSource(42L);

    shift.compute(ctxAt(99, 1, RunConcept.POWER), parent);

    assertThat(parent.nextDouble()).isEqualTo(twin.nextDouble());
  }

  @Test
  void compute_averageAttributes_matchesContextOnlyShift() {
    var shift = new GoalLineRunShift();
    var ctx = ctxWith(99, 10, RunConcept.INSIDE_ZONE, averageAssignment());
    var legacy =
        shift.compute(ctxAt(99, 10, RunConcept.INSIDE_ZONE), new SplittableRandomSource(0L));

    var result = shift.compute(ctx, new SplittableRandomSource(0L));

    assertThat(result)
        .as("league-average attrs leave the goal-line ramp at its baseline magnitude")
        .isCloseTo(legacy, org.assertj.core.data.Offset.offset(1e-12));
  }

  @Test
  void compute_atTheOne_offenseMuscle_dampensRamp() {
    var shift = new GoalLineRunShift();
    var baseline =
        shift.compute(
            ctxWith(99, 1, RunConcept.POWER, averageAssignment()), new SplittableRandomSource(0L));

    var muscle =
        shift.compute(
            ctxWith(99, 1, RunConcept.POWER, assignmentWith(eliteOffense(), averageDefense())),
            new SplittableRandomSource(0L));

    assertThat(muscle)
        .as("a powerful carrier behind a dominant OL closes the goal-line gap")
        .isGreaterThan(baseline);
    assertThat(muscle).as("the ramp is still negative inside the red zone").isNegative();
  }

  @Test
  void compute_atTheOne_defenseMuscle_amplifiesRamp() {
    var shift = new GoalLineRunShift();
    var baseline =
        shift.compute(
            ctxWith(99, 1, RunConcept.POWER, averageAssignment()), new SplittableRandomSource(0L));

    var stoneWall =
        shift.compute(
            ctxWith(99, 1, RunConcept.POWER, assignmentWith(averageOffense(), eliteDefense())),
            new SplittableRandomSource(0L));

    assertThat(stoneWall).as("an elite goal-line front sinks the ramp deeper").isLessThan(baseline);
  }

  @Test
  void compute_outsideRedZone_attributesIgnored() {
    var shift = new GoalLineRunShift();

    var muscle =
        shift.compute(
            ctxWith(
                50, 10, RunConcept.INSIDE_ZONE, assignmentWith(eliteOffense(), averageDefense())),
            new SplittableRandomSource(0L));

    assertThat(muscle)
        .as("attributes only modulate the red-zone ramp; outside the red zone the shift stays zero")
        .isZero();
  }

  private static RunMatchupContext ctxWith(
      int yardLine, int yardsToGo, RunConcept concept, RoleAssignmentPair assignment) {
    return new RunMatchupContext(
        concept,
        EMPTY_ROLES,
        OffensiveFormation.SINGLEBACK,
        yardLine,
        yardsToGo,
        MatchupContextDefaults.OFFENSE,
        MatchupContextDefaults.DEFENSE,
        MatchupContextDefaults.BASELINE_OFFENSE,
        assignment);
  }

  private static RoleAssignmentPair averageAssignment() {
    return assignmentWith(averageOffense(), averageDefense());
  }

  private static RoleAssignmentPair assignmentWith(
      Map<OffensiveRole, Player> offense, Map<DefensiveRole, Player> defense) {
    return new RoleAssignmentPair(
        new OffensiveRoleAssignment(offense), new DefensiveRoleAssignment(defense));
  }

  private static Map<OffensiveRole, Player> averageOffense() {
    var off = new EnumMap<OffensiveRole, Player>(OffensiveRole.class);
    off.put(OffensiveRole.RB_RUSH, rb(0, 50, 50, 50));
    off.put(OffensiveRole.LT, ol(1, 50));
    off.put(OffensiveRole.LG, ol(2, 50));
    off.put(OffensiveRole.C, ol(3, 50));
    off.put(OffensiveRole.RG, ol(4, 50));
    off.put(OffensiveRole.RT, ol(5, 50));
    return off;
  }

  private static Map<OffensiveRole, Player> eliteOffense() {
    var off = new EnumMap<OffensiveRole, Player>(OffensiveRole.class);
    off.put(OffensiveRole.RB_RUSH, rb(0, 100, 100, 100));
    off.put(OffensiveRole.LT, ol(1, 100));
    off.put(OffensiveRole.LG, ol(2, 100));
    off.put(OffensiveRole.C, ol(3, 100));
    off.put(OffensiveRole.RG, ol(4, 100));
    off.put(OffensiveRole.RT, ol(5, 100));
    return off;
  }

  private static Map<DefensiveRole, Player> averageDefense() {
    var def = new EnumMap<DefensiveRole, Player>(DefensiveRole.class);
    def.put(DefensiveRole.NOSE, dl(11, 50, 50));
    def.put(DefensiveRole.THREE_TECH, dl(12, 50, 50));
    def.put(DefensiveRole.FIVE_TECH, dl(13, 50, 50));
    def.put(DefensiveRole.EDGE, dl(14, 50, 50));
    def.put(DefensiveRole.MIKE_LB, lb(15, 50, 50));
    def.put(DefensiveRole.WILL_LB, lb(16, 50, 50));
    def.put(DefensiveRole.SAM_LB, lb(17, 50, 50));
    return def;
  }

  private static Map<DefensiveRole, Player> eliteDefense() {
    var def = new EnumMap<DefensiveRole, Player>(DefensiveRole.class);
    def.put(DefensiveRole.NOSE, dl(11, 100, 100));
    def.put(DefensiveRole.THREE_TECH, dl(12, 100, 100));
    def.put(DefensiveRole.FIVE_TECH, dl(13, 100, 100));
    def.put(DefensiveRole.EDGE, dl(14, 100, 100));
    def.put(DefensiveRole.MIKE_LB, lb(15, 100, 100));
    def.put(DefensiveRole.WILL_LB, lb(16, 100, 100));
    def.put(DefensiveRole.SAM_LB, lb(17, 100, 100));
    return def;
  }

  private static Player rb(int seed, int breakTackle, int power, int strength) {
    return new Player(
        new PlayerId(new UUID(0L, seed)),
        Position.RB,
        "RB-" + seed,
        new Physical(50, 50, 50, strength, power, 50, 50, 50),
        new Skill(
            50,
            50,
            50,
            50,
            50,
            50,
            50,
            50,
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

  private static Player ol(int seed, int runBlock) {
    return new Player(
        new PlayerId(new UUID(0L, seed)),
        Position.OL,
        "OL-" + seed,
        Physical.average(),
        new Skill(
            50, 50, 50, 50, 50, 50, runBlock, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
            50, 50, 50, 50, 50, 50, 50, 50, 50),
        Tendencies.average());
  }

  private static Player dl(int seed, int blockShed, int strength) {
    return new Player(
        new PlayerId(new UUID(0L, seed)),
        Position.DL,
        "DL-" + seed,
        new Physical(50, 50, 50, strength, strength, 50, 50, 50),
        new Skill(
            50, 50, 50, 50, blockShed, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
            50, 50, 50, 50, 50, 50, 50, 50, 50),
        Tendencies.average());
  }

  private static Player lb(int seed, int blockShed, int tackling) {
    return new Player(
        new PlayerId(new UUID(0L, seed)),
        Position.LB,
        "LB-" + seed,
        Physical.average(),
        new Skill(
            50, 50, 50, 50, blockShed, 50, 50, 50, 50, tackling, 50, 50, 50, 50, 50, 50, 50, 50, 50,
            50, 50, 50, 50, 50, 50, 50, 50, 50, 50),
        Tendencies.average());
  }
}
