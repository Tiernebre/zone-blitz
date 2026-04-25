package app.zoneblitz.scouting;

import java.util.List;
import java.util.Objects;

/**
 * Scouting view of a player's fit within a {@code ResolvedScheme}. {@link #bestFit()} is the role
 * that maximizes {@link RoleFit#score()} among the scheme's available roles for the player's
 * position; {@link #alternateFits()} carries the next-best roles. {@link #versatility()} measures
 * how flat the role-fit distribution is — high values indicate a balanced player who could fill
 * multiple roles, low values a specialist.
 *
 * <p>Critically, there is no global tier or OVR. {@link RoleFit#tier()} is always relative to a
 * comparison pool (the same-position bodies who could plausibly play that role); the same player
 * can carry an {@code A} tier in one scheme and a {@code C} in another.
 */
public record SchemeFit(RoleFit bestFit, List<RoleFit> alternateFits, double versatility) {

  public SchemeFit {
    Objects.requireNonNull(bestFit, "bestFit");
    Objects.requireNonNull(alternateFits, "alternateFits");
    if (versatility < 0.0 || versatility > 1.0 || Double.isNaN(versatility)) {
      throw new IllegalArgumentException("versatility must be in [0, 1], got " + versatility);
    }
    alternateFits = List.copyOf(alternateFits);
  }
}
