package app.zoneblitz.league.hiring.generation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.Objects;

/**
 * Typed view over the {@code tiers.HC} section of {@code data/bands/coach-market.json}. Parsed once
 * at construction and handed to the generator so no I/O happens mid-generation.
 */
record HeadCoachMarketBands(
    int salaryP10,
    int salaryP50,
    int salaryP90,
    int salaryCeiling,
    int salaryMin,
    int contractModeYears,
    int contractP10Years,
    int contractP50Years,
    int contractP90Years,
    int ageMode,
    int ageP10,
    int ageP50,
    int ageP90,
    int ageMin,
    int ageMax,
    double experienceP10Years,
    double experienceMeanYears,
    double experienceP90Years,
    double firstTimeHcRate,
    double offenseShare,
    double defenseShare,
    double ceoShare) {

  static HeadCoachMarketBands loadFromClasspath() {
    return loadFromClasspath("/bands/coach-market.json");
  }

  static HeadCoachMarketBands loadFromClasspath(String resource) {
    Objects.requireNonNull(resource, "resource");
    try (InputStream in = HeadCoachMarketBands.class.getResourceAsStream(resource)) {
      if (in == null) {
        throw new IllegalStateException("Band resource not found on classpath: " + resource);
      }
      var root = new ObjectMapper().readTree(in);
      return fromJson(root.at("/tiers/HC"));
    } catch (IOException e) {
      throw new IllegalStateException("Failed to read " + resource, e);
    }
  }

  private static HeadCoachMarketBands fromJson(JsonNode hc) {
    if (hc == null || hc.isMissingNode()) {
      throw new IllegalStateException("coach-market.json missing tiers.HC");
    }
    var salary = hc.get("salary_annual_usd");
    var contract = hc.get("contract_length_years");
    var age = hc.get("age_distribution");
    var experience = hc.get("experience_distribution");
    var split = hc.get("playcaller_specialty_split");
    return new HeadCoachMarketBands(
        salary.get("p10").asInt(),
        salary.get("p50").asInt(),
        salary.get("p90").asInt(),
        salary.get("ceiling").asInt(),
        (int) Math.round(salary.get("p10").asInt() * 0.5),
        contract.get("mode").asInt(),
        contract.get("p10").asInt(),
        contract.get("p50").asInt(),
        contract.get("p90").asInt(),
        age.get("mode").asInt(),
        age.get("p10").asInt(),
        age.get("p50").asInt(),
        age.get("p90").asInt(),
        age.get("min").asInt(),
        age.get("max").asInt(),
        experience.get("years_experience_p10").asDouble(),
        experience.get("years_experience_mean").asDouble(),
        experience.get("years_experience_p90").asDouble(),
        experience.get("first_time_hc_rate").asDouble(),
        split.get("offense").asDouble(),
        split.get("defense").asDouble(),
        split.get("ceo").asDouble());
  }

  BigDecimal salaryP10Dec() {
    return BigDecimal.valueOf(salaryP10);
  }

  BigDecimal salaryP50Dec() {
    return BigDecimal.valueOf(salaryP50);
  }

  BigDecimal salaryP90Dec() {
    return BigDecimal.valueOf(salaryP90);
  }

  BigDecimal salaryCeilingDec() {
    return BigDecimal.valueOf(salaryCeiling);
  }
}
