package app.zoneblitz.gamesimulator.resolver.run;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.BoxCountSampler;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.formation.PlayType;
import app.zoneblitz.gamesimulator.resolver.MatchupContextDefaults;
import app.zoneblitz.gamesimulator.resolver.RunRoles;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import java.util.List;
import java.util.Optional;
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
