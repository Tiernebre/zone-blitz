package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.resolver.pass.MatchupPassResolver.PassMatchupShift;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.List;
import java.util.Objects;

/** Sum of multiple {@link PassMatchupShift} components. Mirror of the run-side composite. */
public final class CompositePassMatchupShift implements PassMatchupShift {

  private final List<PassMatchupShift> components;

  public CompositePassMatchupShift(PassMatchupShift... components) {
    this(List.of(components));
  }

  public CompositePassMatchupShift(List<PassMatchupShift> components) {
    Objects.requireNonNull(components, "components");
    components.forEach(c -> Objects.requireNonNull(c, "component"));
    this.components = List.copyOf(components);
  }

  @Override
  public double compute(PassMatchupContext context, RandomSource rng) {
    var sum = 0.0;
    for (var component : components) {
      sum += component.compute(context, rng);
    }
    return sum;
  }
}
