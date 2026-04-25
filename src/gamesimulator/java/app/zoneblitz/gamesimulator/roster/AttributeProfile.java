package app.zoneblitz.gamesimulator.roster;

import java.util.List;
import java.util.Objects;

/**
 * Per-position attribute generation profile. The component list is the position's mixture
 * distribution; weights must sum to {@code 1.0} within a small tolerance. Single-component profiles
 * (K, P, LS, FB) are legal and represent positions with no empirical bimodality.
 */
public record AttributeProfile(Position position, List<AttributeMixtureComponent> components) {

  private static final double WEIGHT_SUM_TOLERANCE = 1.0e-3;

  public AttributeProfile {
    Objects.requireNonNull(position, "position");
    Objects.requireNonNull(components, "components");
    if (components.isEmpty()) {
      throw new IllegalArgumentException("components must not be empty for " + position);
    }
    var sum = 0.0;
    for (var c : components) {
      Objects.requireNonNull(c, "component");
      sum += c.weight();
    }
    if (Math.abs(sum - 1.0) > WEIGHT_SUM_TOLERANCE) {
      throw new IllegalArgumentException(
          "component weights must sum to 1.0 (±"
              + WEIGHT_SUM_TOLERANCE
              + "), got "
              + sum
              + " for "
              + position);
    }
    components = List.copyOf(components);
  }
}
