package app.zoneblitz.gamesimulator.roster;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import app.zoneblitz.gamesimulator.role.PhysicalAxis;
import app.zoneblitz.gamesimulator.role.SkillAxis;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class CholeskyPlayerGeneratorTests {

  private static final PlayerId ID = new PlayerId(new UUID(7L, 7L));

  @Test
  void constructor_succeedsForAllProfilesOnClasspath() {
    var generator = new CholeskyPlayerGenerator(new ClasspathAttributeProfileRepository());

    assertThat(generator).isNotNull();
  }

  @ParameterizedTest
  @EnumSource(Position.class)
  void generate_producesValuesInRange(Position position) {
    var generator = new CholeskyPlayerGenerator(new ClasspathAttributeProfileRepository());
    var rng = new SplittableRandomSource(123L);

    for (var i = 0; i < 50; i++) {
      var player = generator.generate(ID, position, "Test", rng);

      assertPhysicalAxesInRange(player.physical());
      assertSkillAxesInRange(player.skill());
      assertTendencyAxesInRange(player.tendencies());
      assertThat(player.position()).isEqualTo(position);
    }
  }

  @Test
  void generate_sameSeed_sameOutput() {
    var generator = new CholeskyPlayerGenerator(new ClasspathAttributeProfileRepository());

    var rng1 = new SplittableRandomSource(42L);
    var rng2 = new SplittableRandomSource(42L);

    var p1 = generator.generate(ID, Position.S, "Twin", rng1);
    var p2 = generator.generate(ID, Position.S, "Twin", rng2);

    assertThat(p1).isEqualTo(p2);
  }

  @Test
  void generate_differentSeeds_differentOutput() {
    var generator = new CholeskyPlayerGenerator(new ClasspathAttributeProfileRepository());

    var p1 = generator.generate(ID, Position.S, "A", new SplittableRandomSource(1L));
    var p2 = generator.generate(ID, Position.S, "A", new SplittableRandomSource(2L));

    assertThat(p1).isNotEqualTo(p2);
  }

  @Test
  void generate_safetyMarginalsCenterNearJsonMeans() {
    var generator = new CholeskyPlayerGenerator(new ClasspathAttributeProfileRepository());
    var rng = new SplittableRandomSource(99L);

    var n = 2000;
    var tacklingSum = 0L;
    var coverageSum = 0L;
    for (var i = 0; i < n; i++) {
      var player = generator.generate(ID, Position.S, "S", rng);
      tacklingSum += player.skill().tackling();
      coverageSum += player.skill().coverageTechnique();
    }
    var tacklingMean = tacklingSum / (double) n;
    var coverageMean = coverageSum / (double) n;

    assertThat(tacklingMean).isBetween(60.0, 80.0);
    assertThat(coverageMean).isBetween(55.0, 75.0);
  }

  @Test
  void generate_quarterbackPuntPowerStaysAtFloor() {
    var generator = new CholeskyPlayerGenerator(new ClasspathAttributeProfileRepository());
    var rng = new SplittableRandomSource(10L);

    var n = 500;
    var sum = 0L;
    for (var i = 0; i < n; i++) {
      var qb = generator.generate(ID, Position.QB, "QB", rng);
      sum += qb.skill().puntPower();
    }
    var mean = sum / (double) n;

    assertThat(mean).isLessThan(25.0);
  }

  @Test
  void constructor_appliesShrinkageForMildlyNonPsdMatrix() {
    var mildlyBrokenRepo =
        (AttributeProfileRepository)
            position ->
                new AttributeProfile(
                    position,
                    List.of(
                        new AttributeMixtureComponent(
                            1.0,
                            "needs-shrinkage",
                            Map.of(
                                PhysicalAxis.SPEED, 80.0,
                                PhysicalAxis.ACCELERATION, 80.0,
                                PhysicalAxis.EXPLOSIVENESS, 80.0),
                            Map.of(
                                PhysicalAxis.SPEED, 5.0,
                                PhysicalAxis.ACCELERATION, 5.0,
                                PhysicalAxis.EXPLOSIVENESS, 5.0),
                            Map.of(
                                AxisPair.of(PhysicalAxis.SPEED, PhysicalAxis.ACCELERATION),
                                0.85,
                                AxisPair.of(PhysicalAxis.ACCELERATION, PhysicalAxis.EXPLOSIVENESS),
                                0.7))));

    var generator = new CholeskyPlayerGenerator(mildlyBrokenRepo);

    var rng = new SplittableRandomSource(7L);
    var p = generator.generate(ID, Position.S, "X", rng);
    assertThat(p.physical().speed()).isBetween(0, 100);
  }

  @Test
  void generate_safetyMixtureProducesBoxAndCoverageShapes() {
    var generator = new CholeskyPlayerGenerator(new ClasspathAttributeProfileRepository());
    var rng = new SplittableRandomSource(55L);

    var boxLeaning = 0;
    var coverageLeaning = 0;
    for (var i = 0; i < 1000; i++) {
      var s = generator.generate(ID, Position.S, "S", rng);
      var coverageEdge = s.skill().coverageTechnique() - s.skill().tackling();
      if (coverageEdge < -10) boxLeaning++;
      if (coverageEdge > 10) coverageLeaning++;
    }

    assertThat(boxLeaning).isGreaterThan(150);
    assertThat(coverageLeaning).isGreaterThan(150);
  }

  private static void assertPhysicalAxesInRange(Physical p) {
    for (var axis : PhysicalAxis.values()) {
      assertThat(axis.extract(p)).isBetween(0, 100);
    }
  }

  private static void assertSkillAxesInRange(Skill s) {
    for (var axis : SkillAxis.values()) {
      assertThat(axis.extract(s)).isBetween(0, 100);
    }
  }

  private static void assertTendencyAxesInRange(Tendencies t) {
    for (var axis : app.zoneblitz.gamesimulator.role.TendencyAxis.values()) {
      assertThat(axis.extract(t)).isBetween(0, 100);
    }
  }
}
