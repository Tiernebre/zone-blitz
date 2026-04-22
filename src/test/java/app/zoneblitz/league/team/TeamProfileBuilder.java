package app.zoneblitz.league.team;

import app.zoneblitz.league.geography.Climate;
import app.zoneblitz.league.geography.Geography;
import app.zoneblitz.league.geography.MarketSize;
import app.zoneblitz.league.hiring.CompetitiveWindow;
import java.math.BigDecimal;

/**
 * Fluent builder for {@link TeamProfile} in test code. Defaults produce a plausible valid instance
 * (large NE market, neutral climate, contender window, mid-range dynamic attributes, WEST_COAST
 * scheme); {@code with*} methods override individual fields.
 */
final class TeamProfileBuilder {

  private long teamId = 1L;
  private MarketSize marketSize = MarketSize.LARGE;
  private Geography geography = Geography.NE;
  private Climate climate = Climate.NEUTRAL;
  private BigDecimal prestige = new BigDecimal("75.00");
  private CompetitiveWindow window = CompetitiveWindow.CONTENDER;
  private BigDecimal ownerStability = new BigDecimal("60.00");
  private BigDecimal facilityQuality = new BigDecimal("80.00");
  private String schemeAlignment = "WEST_COAST";

  static TeamProfileBuilder aTeamProfile() {
    return new TeamProfileBuilder();
  }

  TeamProfileBuilder withTeamId(long teamId) {
    this.teamId = teamId;
    return this;
  }

  TeamProfileBuilder withMarketSize(MarketSize marketSize) {
    this.marketSize = marketSize;
    return this;
  }

  TeamProfileBuilder withGeography(Geography geography) {
    this.geography = geography;
    return this;
  }

  TeamProfileBuilder withClimate(Climate climate) {
    this.climate = climate;
    return this;
  }

  TeamProfileBuilder withPrestige(BigDecimal prestige) {
    this.prestige = prestige;
    return this;
  }

  TeamProfileBuilder withPrestige(String prestige) {
    this.prestige = new BigDecimal(prestige);
    return this;
  }

  TeamProfileBuilder withWindow(CompetitiveWindow window) {
    this.window = window;
    return this;
  }

  TeamProfileBuilder withOwnerStability(BigDecimal ownerStability) {
    this.ownerStability = ownerStability;
    return this;
  }

  TeamProfileBuilder withOwnerStability(String ownerStability) {
    this.ownerStability = new BigDecimal(ownerStability);
    return this;
  }

  TeamProfileBuilder withFacilityQuality(BigDecimal facilityQuality) {
    this.facilityQuality = facilityQuality;
    return this;
  }

  TeamProfileBuilder withFacilityQuality(String facilityQuality) {
    this.facilityQuality = new BigDecimal(facilityQuality);
    return this;
  }

  TeamProfileBuilder withSchemeAlignment(String schemeAlignment) {
    this.schemeAlignment = schemeAlignment;
    return this;
  }

  TeamProfile build() {
    return new TeamProfile(
        teamId,
        marketSize,
        geography,
        climate,
        prestige,
        window,
        ownerStability,
        facilityQuality,
        schemeAlignment);
  }
}
