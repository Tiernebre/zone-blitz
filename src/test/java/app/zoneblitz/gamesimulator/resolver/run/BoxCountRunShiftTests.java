package app.zoneblitz.gamesimulator.resolver.run;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.BoxCountSampler;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.formation.PlayType;
import app.zoneblitz.gamesimulator.resolver.MatchupContextDefaults;
import app.zoneblitz.gamesimulator.resolver.RunRoles;
import app.zoneblitz.gamesimulator.rng.RandomSource;
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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BoxCountRunShiftTests {

  private static final RunMatchupContext CTX =
      new RunMatchupContext(
          RunConcept.INSIDE_ZONE,
          new RunRoles(Optional.empty(), List.of(), List.of()),
          OffensiveFormation.SINGLEBACK,
          50,
          10,
          MatchupContextDefaults.OFFENSE,
          MatchupContextDefaults.DEFENSE,
          MatchupContextDefaults.EMPTY_ASSIGNMENT);

  @Test
  void compute_sampledEqualsExpected_returnsZero() {
    var sampler = new FixedSampler(7, 7.0);
    var shift = new BoxCountRunShift(sampler, -0.25);

    var result = shift.compute(CTX, new SplittableRandomSource(0L));

    assertThat(result).isZero();
  }

  @Test
  void compute_heavyBox_returnsNegative() {
    var sampler = new FixedSampler(9, 7.0);
    var shift = new BoxCountRunShift(sampler, -0.25);

    var result = shift.compute(CTX, new SplittableRandomSource(0L));

    assertThat(result).isEqualTo(-0.5); // (9 - 7) * -0.25
  }

  @Test
  void compute_lightBox_returnsPositive() {
    var sampler = new FixedSampler(5, 7.0);
    var shift = new BoxCountRunShift(sampler, -0.25);

    var result = shift.compute(CTX, new SplittableRandomSource(0L));

    assertThat(result).isEqualTo(0.5); // (5 - 7) * -0.25
  }

  @Test
  void compute_positiveBoxLoadingShift_pullsTowardHeavierBox() {
    var ctxWithLoad =
        new RunMatchupContext(
            RunConcept.INSIDE_ZONE,
            new RunRoles(Optional.empty(), List.of(), List.of()),
            OffensiveFormation.SINGLEBACK,
            50,
            10,
            MatchupContextDefaults.OFFENSE,
            MatchupContextDefaults.DEFENSE,
            MatchupContextDefaults.EMPTY_ASSIGNMENT,
            1.0);
    var sampler = new FixedSampler(7, 7.0);
    var shift = new BoxCountRunShift(sampler, -0.25);

    var result = shift.compute(ctxWithLoad, new SplittableRandomSource(0L));

    assertThat(result).isEqualTo(-0.25); // (7 + 1.0 - 7) * -0.25
  }

  @Test
  void compute_usesSplitChildStream_notParent() {
    // The shift must split the RNG — the parent's stream must still be at its original position
    // after a compute() call.
    var parent = new SplittableRandomSource(42L);
    var twin = new SplittableRandomSource(42L);
    var sampler = new FixedSampler(7, 7.0);
    var shift = new BoxCountRunShift(sampler);

    shift.compute(CTX, parent);

    assertThat(parent.nextDouble()).isEqualTo(twin.nextDouble());
  }

  @Test
  void compute_averageAttributes_matchesContextOnlyShift() {
    var sampler = new FixedSampler(9, 7.0);
    var shift = new BoxCountRunShift(sampler, -0.25);

    var contextOnly = shift.compute(CTX, new SplittableRandomSource(0L));
    var withAvgAttrs = shift.compute(ctxWith(averageAssignment()), new SplittableRandomSource(0L));

    assertThat(withAvgAttrs)
        .as("league-average OL/DL leaves the box-count contribution at its baseline")
        .isCloseTo(contextOnly, org.assertj.core.data.Offset.offset(1e-12));
  }

  @Test
  void compute_heavyBox_dominantOl_dampensPenalty() {
    var sampler = new FixedSampler(9, 7.0);
    var shift = new BoxCountRunShift(sampler, -0.25);

    var baseline = shift.compute(ctxWith(averageAssignment()), new SplittableRandomSource(0L));
    var dominantOl =
        shift.compute(
            ctxWith(assignmentWith(eliteOlSkill(), averageDl())), new SplittableRandomSource(0L));

    assertThat(dominantOl)
        .as("elite OL run-block reduces the magnitude of the heavy-box penalty")
        .isGreaterThan(baseline);
    assertThat(dominantOl).as("the penalty is still negative — heavy box still hurts").isNegative();
  }

  @Test
  void compute_heavyBox_dominantDl_amplifiesPenalty() {
    var sampler = new FixedSampler(9, 7.0);
    var shift = new BoxCountRunShift(sampler, -0.25);

    var baseline = shift.compute(ctxWith(averageAssignment()), new SplittableRandomSource(0L));
    var dominantDl =
        shift.compute(
            ctxWith(assignmentWith(averageOl(), eliteDlBlockShed())),
            new SplittableRandomSource(0L));

    assertThat(dominantDl)
        .as("elite DL block-shedding amplifies the heavy-box penalty")
        .isLessThan(baseline);
  }

  @Test
  void compute_lightBox_dominantOl_dampensBonus() {
    var sampler = new FixedSampler(5, 7.0);
    var shift = new BoxCountRunShift(sampler, -0.25);

    var baseline = shift.compute(ctxWith(averageAssignment()), new SplittableRandomSource(0L));
    var dominantOl =
        shift.compute(
            ctxWith(assignmentWith(eliteOlSkill(), averageDl())), new SplittableRandomSource(0L));

    assertThat(dominantOl)
        .as("when the offense already dominates, light-box bonus shrinks toward parity")
        .isLessThan(baseline);
    assertThat(dominantOl).as("the contribution remains positive").isPositive();
  }

  private static RunMatchupContext ctxWith(RoleAssignmentPair assignment) {
    return new RunMatchupContext(
        RunConcept.INSIDE_ZONE,
        new RunRoles(Optional.empty(), List.of(), List.of()),
        OffensiveFormation.SINGLEBACK,
        50,
        10,
        MatchupContextDefaults.OFFENSE,
        MatchupContextDefaults.DEFENSE,
        assignment);
  }

  private static RoleAssignmentPair averageAssignment() {
    return assignmentWith(averageOl(), averageDl());
  }

  private static RoleAssignmentPair assignmentWith(List<Player> oline, List<Player> dline) {
    var off = new java.util.EnumMap<OffensiveRole, Player>(OffensiveRole.class);
    off.put(OffensiveRole.LT, oline.get(0));
    off.put(OffensiveRole.LG, oline.get(1));
    off.put(OffensiveRole.C, oline.get(2));
    off.put(OffensiveRole.RG, oline.get(3));
    off.put(OffensiveRole.RT, oline.get(4));
    var def = new java.util.EnumMap<DefensiveRole, Player>(DefensiveRole.class);
    def.put(DefensiveRole.NOSE, dline.get(0));
    def.put(DefensiveRole.THREE_TECH, dline.get(1));
    def.put(DefensiveRole.FIVE_TECH, dline.get(2));
    def.put(DefensiveRole.EDGE, dline.get(3));
    return new RoleAssignmentPair(
        new OffensiveRoleAssignment(Map.copyOf(off)), new DefensiveRoleAssignment(Map.copyOf(def)));
  }

  private static List<Player> averageOl() {
    return List.of(ol(1, 50), ol(2, 50), ol(3, 50), ol(4, 50), ol(5, 50));
  }

  private static List<Player> eliteOlSkill() {
    return List.of(ol(1, 100), ol(2, 100), ol(3, 100), ol(4, 100), ol(5, 100));
  }

  private static List<Player> averageDl() {
    return List.of(dl(11, 50, 50), dl(12, 50, 50), dl(13, 50, 50), dl(14, 50, 50));
  }

  private static List<Player> eliteDlBlockShed() {
    return List.of(dl(11, 100, 100), dl(12, 100, 100), dl(13, 100, 100), dl(14, 100, 100));
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

  private static final class FixedSampler implements BoxCountSampler {
    private final int fixed;
    private final double expected;

    FixedSampler(int fixed, double expected) {
      this.fixed = fixed;
      this.expected = expected;
    }

    @Override
    public int sample(OffensiveFormation formation, PlayType playType, RandomSource rng) {
      rng.nextDouble(); // consume a draw to mirror real samplers
      return fixed;
    }

    @Override
    public double expectedBox(OffensiveFormation formation, PlayType playType) {
      return expected;
    }
  }
}
