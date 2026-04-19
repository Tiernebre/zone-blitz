package app.zoneblitz.league;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * v1 {@link FranchiseProfiles}: maps each seeded franchise city to static market-size, geography,
 * and climate constants. Dynamic preference dimensions resolve to equal-footing constants so they
 * do not discriminate between franchises until a franchise-ratings layer lands (see {@code
 * docs/technical/league-phases.md} "v1 equal-footing note").
 */
@Component
class CityFranchiseProfiles implements FranchiseProfiles {

  private static final BigDecimal EQUAL_FOOTING_PRESTIGE = new BigDecimal("50.00");
  private static final BigDecimal EQUAL_FOOTING_OWNER_STABILITY = new BigDecimal("50.00");
  private static final BigDecimal EQUAL_FOOTING_FACILITY_QUALITY = new BigDecimal("50.00");
  private static final CompetitiveWindow EQUAL_FOOTING_WINDOW = CompetitiveWindow.NEUTRAL;
  private static final String EQUAL_FOOTING_SCHEME = "BALANCED";

  // Static per-city attributes for the v1 seeded franchises. Keyed by city name; state code is
  // ignored because names are unique across the seed set.
  private static final Map<String, CityAttrs> CITY_ATTRS =
      Map.of(
          "Boston", new CityAttrs(MarketSize.LARGE, Geography.NE, Climate.COLD),
          "New York", new CityAttrs(MarketSize.LARGE, Geography.NE, Climate.COLD),
          "Atlanta", new CityAttrs(MarketSize.LARGE, Geography.SE, Climate.WARM),
          "Miami", new CityAttrs(MarketSize.LARGE, Geography.SE, Climate.WARM),
          "Chicago", new CityAttrs(MarketSize.LARGE, Geography.MW, Climate.COLD),
          "Dallas", new CityAttrs(MarketSize.LARGE, Geography.SW, Climate.WARM),
          "Denver", new CityAttrs(MarketSize.MEDIUM, Geography.W, Climate.COLD),
          "Los Angeles", new CityAttrs(MarketSize.LARGE, Geography.W, Climate.WARM));

  private static final CityAttrs FALLBACK =
      new CityAttrs(MarketSize.MEDIUM, Geography.MW, Climate.NEUTRAL);

  private final FranchiseRepository franchises;

  CityFranchiseProfiles(FranchiseRepository franchises) {
    this.franchises = franchises;
  }

  @Override
  public Optional<FranchiseProfile> forFranchise(long franchiseId) {
    return franchises
        .findById(franchiseId)
        .map(
            f -> {
              var attrs = CITY_ATTRS.getOrDefault(f.city().name(), FALLBACK);
              return new FranchiseProfile(
                  f.id(),
                  attrs.marketSize(),
                  attrs.geography(),
                  attrs.climate(),
                  EQUAL_FOOTING_PRESTIGE,
                  EQUAL_FOOTING_WINDOW,
                  EQUAL_FOOTING_OWNER_STABILITY,
                  EQUAL_FOOTING_FACILITY_QUALITY,
                  EQUAL_FOOTING_SCHEME);
            });
  }

  private record CityAttrs(MarketSize marketSize, Geography geography, Climate climate) {}
}
