package app.zoneblitz.gamesimulator.roster;

import app.zoneblitz.gamesimulator.role.AttributeAxis;
import java.util.Map;
import java.util.Objects;

/**
 * One generation cluster within an {@link AttributeProfile}. The mixture lets a position have
 * empirically distinct shapes (a box safety vs. a coverage safety) without storing an archetype
 * label on {@link Player} — the {@link #name() name} is documentation for humans reading the JSON,
 * never read at runtime.
 *
 * <p>The means/stddevs maps are partial: only axes the component cares about are listed. The
 * sampler fills unspecified axes from a cross-position floor (mean ≈ 10, sd ≈ 5) so an irrelevant
 * skill (a QB's punt power) lands at sub-pro values.
 *
 * <p>Correlations are pairwise; unspecified pairs default to 0. Self-correlations (diagonal) are
 * implicit at 1.0 and may not be supplied. Values must be in {@code [-1, +1]}.
 */
public record AttributeMixtureComponent(
    double weight,
    String name,
    Map<AttributeAxis, Double> means,
    Map<AttributeAxis, Double> stddevs,
    Map<AxisPair, Double> correlations) {

  public AttributeMixtureComponent {
    Objects.requireNonNull(name, "name");
    Objects.requireNonNull(means, "means");
    Objects.requireNonNull(stddevs, "stddevs");
    Objects.requireNonNull(correlations, "correlations");
    if (weight < 0.0 || Double.isNaN(weight) || Double.isInfinite(weight)) {
      throw new IllegalArgumentException(
          "weight must be a finite non-negative number, got " + weight);
    }
    requireMeansInBounds(means);
    requireStddevsInBounds(stddevs);
    requireCorrelationsInBounds(correlations);
    means = Map.copyOf(means);
    stddevs = Map.copyOf(stddevs);
    correlations = Map.copyOf(correlations);
  }

  private static void requireMeansInBounds(Map<AttributeAxis, Double> means) {
    for (var entry : means.entrySet()) {
      Objects.requireNonNull(entry.getKey(), "means key");
      var v = entry.getValue();
      Objects.requireNonNull(v, "means value");
      if (v < 0.0 || v > 100.0 || Double.isNaN(v)) {
        throw new IllegalArgumentException(
            "means values must be in [0, 100], got " + v + " for " + entry.getKey().code());
      }
    }
  }

  private static void requireStddevsInBounds(Map<AttributeAxis, Double> stddevs) {
    for (var entry : stddevs.entrySet()) {
      Objects.requireNonNull(entry.getKey(), "stddevs key");
      var v = entry.getValue();
      Objects.requireNonNull(v, "stddevs value");
      if (v < 0.0 || Double.isNaN(v) || Double.isInfinite(v)) {
        throw new IllegalArgumentException(
            "stddevs values must be finite non-negative, got "
                + v
                + " for "
                + entry.getKey().code());
      }
    }
  }

  private static void requireCorrelationsInBounds(Map<AxisPair, Double> correlations) {
    for (var entry : correlations.entrySet()) {
      Objects.requireNonNull(entry.getKey(), "correlations key");
      var v = entry.getValue();
      Objects.requireNonNull(v, "correlations value");
      if (v < -1.0 || v > 1.0 || Double.isNaN(v)) {
        throw new IllegalArgumentException(
            "correlation values must be in [-1, 1], got " + v + " for pair " + entry.getKey());
      }
    }
  }
}
