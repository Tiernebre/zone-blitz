package app.zoneblitz.scouting;

import app.zoneblitz.gamesimulator.role.Role;
import java.util.Objects;

/**
 * A player's fit at a single role within a scheme. {@link #score()} is in {@code [0, 100]} where 50
 * represents an average-everywhere player; {@link #tier()} is the percentile bucket of that score
 * relative to the comparison pool.
 */
public record RoleFit(Role role, double score, FitTier tier) {

  public RoleFit {
    Objects.requireNonNull(role, "role");
    Objects.requireNonNull(tier, "tier");
    if (Double.isNaN(score)) {
      throw new IllegalArgumentException("score must be a real number");
    }
  }
}
