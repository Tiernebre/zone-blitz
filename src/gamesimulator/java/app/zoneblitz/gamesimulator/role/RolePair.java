package app.zoneblitz.gamesimulator.role;

import java.util.Objects;

/**
 * A single offensive-vs-defensive role matchup contributing to a play's matchup shift. The resolver
 * iterates a {@code List<RolePair>} for the snap (sourced from the scheme's role-pair catalog),
 * looks up the {@link RoleDemand} on each side, computes the clamped-delta math, and weights the
 * result by {@link #weight()} before summing.
 *
 * <p>Weight is non-negative. {@code 0.0} means the pair is enumerated but does not contribute on
 * this concept (kept for stability across configurations); {@code 1.0} is the calibration baseline.
 */
public record RolePair(OffensiveRole offense, DefensiveRole defense, double weight) {

  public RolePair {
    Objects.requireNonNull(offense, "offense");
    Objects.requireNonNull(defense, "defense");
    if (weight < 0.0 || Double.isNaN(weight) || Double.isInfinite(weight)) {
      throw new IllegalArgumentException(
          "weight must be a finite non-negative number, got " + weight);
    }
  }

  public static RolePair of(OffensiveRole offense, DefensiveRole defense) {
    return new RolePair(offense, defense, 1.0);
  }
}
