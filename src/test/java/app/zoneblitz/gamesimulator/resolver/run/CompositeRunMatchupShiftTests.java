package app.zoneblitz.gamesimulator.resolver.run;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.resolver.RunRoles;
import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class CompositeRunMatchupShiftTests {

  private static final RunMatchupContext CTX =
      new RunMatchupContext(
          RunConcept.INSIDE_ZONE,
          new RunRoles(Optional.empty(), List.of(), List.of()),
          OffensiveFormation.SINGLEBACK);

  @Test
  void compute_empty_returnsZero() {
    var shift = new CompositeRunMatchupShift(List.of());

    assertThat(shift.compute(CTX, new SplittableRandomSource(0L))).isZero();
  }

  @Test
  void compute_sumsComponents() {
    var shift = new CompositeRunMatchupShift((c, r) -> 0.4, (c, r) -> -0.1, (c, r) -> 0.2);

    assertThat(shift.compute(CTX, new SplittableRandomSource(0L)))
        .isCloseTo(0.5, org.assertj.core.data.Offset.offset(1e-12));
  }
}
