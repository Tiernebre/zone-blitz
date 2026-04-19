package app.zoneblitz.league.hiring;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.Objects;

/**
 * Typed view over the {@code tiers.DIRECTOR} section of {@code data/bands/scout-market.json}.
 * Parsed once at construction so no I/O happens mid-generation. Mirrors {@link
 * HeadCoachMarketBands} for the DoS candidate tier.
 */
public record ScoutMarketBands(
    int salaryP10,
    int salaryP50,
    int salaryP90,
    int salaryCeiling,
    int contractModeYears,
    int contractP10Years,
    int contractP50Years,
    int contractP90Years,
    double experienceP10Years,
    double experienceMeanYears,
    double experienceP90Years,
    int ageMin,
    int ageMode,
    int ageMax,
    double generalistShare) {

  static ScoutMarketBands loadFromClasspath() {
    return loadFromClasspath("/bands/scout-market.json");
  }

  static ScoutMarketBands loadFromClasspath(String resource) {
    Objects.requireNonNull(resource, "resource");
    try (InputStream in = ScoutMarketBands.class.getResourceAsStream(resource)) {
      if (in == null) {
        throw new IllegalStateException("Band resource not found on classpath: " + resource);
      }
      var root = new ObjectMapper().readTree(in);
      return fromJson(root.at("/tiers/DIRECTOR"));
    } catch (IOException e) {
      throw new IllegalStateException("Failed to read " + resource, e);
    }
  }

  private static ScoutMarketBands fromJson(JsonNode director) {
    if (director == null || director.isMissingNode()) {
      throw new IllegalStateException("scout-market.json missing tiers.DIRECTOR");
    }
    var salary = director.get("salary_annual_usd");
    var contract = director.get("contract_length_years");
    var focusSplit = director.get("position_focus_split");
    return new ScoutMarketBands(
        salary.get("p10").asInt(),
        salary.get("p50").asInt(),
        salary.get("p90").asInt(),
        salary.get("ceiling").asInt(),
        contract.get("mode").asInt(),
        contract.get("p10").asInt(),
        contract.get("p50").asInt(),
        contract.get("p90").asInt(),
        // scout-market.json does not publish an experience block for DIRECTOR; anchor on the band
        // notes ("15+ years to crack the ceiling") and the career arc to DoS — rising via area
        // scout
        // → cross-checker typically spans 10-20+ years before reaching director.
        10.0,
        16.0,
        24.0,
        32,
        46,
        68,
        focusSplit.get("generalist").asDouble());
  }
}
