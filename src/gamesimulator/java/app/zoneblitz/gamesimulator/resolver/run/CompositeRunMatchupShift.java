package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.resolver.run.MatchupRunResolver.RunMatchupShift;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.List;
import java.util.Objects;

/**
 * Sum of multiple {@link RunMatchupShift} components. Used to stack concerns like {@link
 * ClampedRunMatchupShift} (talent) and {@link BoxCountRunShift} (pre-snap defensive response)
 * without any single class owning both.
 *
 * <p>An empty list is allowed and evaluates to {@code 0.0} — same as {@link RunMatchupShift#ZERO}.
 */
public final class CompositeRunMatchupShift implements RunMatchupShift {

  private final List<RunMatchupShift> components;

  public CompositeRunMatchupShift(RunMatchupShift... components) {
    this(List.of(components));
  }

  public CompositeRunMatchupShift(List<RunMatchupShift> components) {
    Objects.requireNonNull(components, "components");
    components.forEach(c -> Objects.requireNonNull(c, "component"));
    this.components = List.copyOf(components);
  }

  @Override
  public double compute(RunMatchupContext context, RandomSource rng) {
    var sum = 0.0;
    for (var component : components) {
      sum += component.compute(context, rng);
    }
    return sum;
  }
}
