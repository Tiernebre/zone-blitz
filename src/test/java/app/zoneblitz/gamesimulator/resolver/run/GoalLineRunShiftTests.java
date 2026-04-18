package app.zoneblitz.gamesimulator.resolver.run;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.resolver.RunRoles;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class GoalLineRunShiftTests {

  private static final RunRoles EMPTY_ROLES = new RunRoles(Optional.empty(), List.of(), List.of());

  private static RunMatchupContext ctxAt(int yardLine, int yardsToGo, RunConcept concept) {
    return new RunMatchupContext(
        concept, EMPTY_ROLES, OffensiveFormation.SINGLEBACK, yardLine, yardsToGo);
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
}
