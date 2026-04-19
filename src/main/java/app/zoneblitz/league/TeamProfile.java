package app.zoneblitz.league;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * Snapshot of a team's preference-relevant attributes used by {@link OfferResolver} scoring. Static
 * fields ({@code marketSize}, {@code geography}, {@code climate}) are sourced from the team's
 * franchise city; dynamic fields ({@code prestige}, {@code window}, {@code ownerStability}, {@code
 * facilityQuality}, {@code schemeAlignment}) are equal-footing constants for v1 per {@code
 * docs/technical/league-phases.md} "v1 equal-footing note" — they do not differentiate offers
 * across teams yet but do round-trip so candidates carrying weights on them score consistently.
 */
public record TeamProfile(
    long teamId,
    MarketSize marketSize,
    Geography geography,
    Climate climate,
    BigDecimal prestige,
    CompetitiveWindow window,
    BigDecimal ownerStability,
    BigDecimal facilityQuality,
    String schemeAlignment) {

  public TeamProfile {
    Objects.requireNonNull(marketSize, "marketSize");
    Objects.requireNonNull(geography, "geography");
    Objects.requireNonNull(climate, "climate");
    Objects.requireNonNull(prestige, "prestige");
    Objects.requireNonNull(window, "window");
    Objects.requireNonNull(ownerStability, "ownerStability");
    Objects.requireNonNull(facilityQuality, "facilityQuality");
    Objects.requireNonNull(schemeAlignment, "schemeAlignment");
  }
}
