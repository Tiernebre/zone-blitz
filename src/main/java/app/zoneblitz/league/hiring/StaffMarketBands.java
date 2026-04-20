package app.zoneblitz.league.hiring;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

/**
 * Typed view over {@code data/bands/staff-market.json} — per-role contract-structure distributions
 * (length years, guarantee %, annual salary) covering every {@link CandidateKind}. Parsed once at
 * construction so no I/O happens mid-generation or mid-hire.
 *
 * <p>Lives alongside {@link HeadCoachMarketBands} and {@link ScoutMarketBands} — those drive
 * candidate <em>generation</em> for their specific tiers; this band file adds the contract shape
 * (length, guarantee) used at hire time and provides a single consistent salary source for roles
 * that don't yet have a dedicated band file (coordinators, position coaches, scouts).
 *
 * <p>Salaries are raw USD dollars (matching the JSON's {@code salary_annual_usd} convention), not
 * cents — consumers that need cents convert at the boundary.
 */
final class StaffMarketBands {

  private final Map<CandidateKind, ContractLengthBand> contractLengths;
  private final Map<CandidateKind, GuaranteePctBand> guaranteePcts;
  private final Map<CandidateKind, SalaryBand> salaries;

  private StaffMarketBands(
      Map<CandidateKind, ContractLengthBand> contractLengths,
      Map<CandidateKind, GuaranteePctBand> guaranteePcts,
      Map<CandidateKind, SalaryBand> salaries) {
    this.contractLengths = Map.copyOf(contractLengths);
    this.guaranteePcts = Map.copyOf(guaranteePcts);
    this.salaries = Map.copyOf(salaries);
  }

  static StaffMarketBands loadFromClasspath() {
    return loadFromClasspath("/bands/staff-market.json");
  }

  static StaffMarketBands loadFromClasspath(String resource) {
    Objects.requireNonNull(resource, "resource");
    try (InputStream in = StaffMarketBands.class.getResourceAsStream(resource)) {
      if (in == null) {
        throw new IllegalStateException("Band resource not found on classpath: " + resource);
      }
      var root = new ObjectMapper().readTree(in);
      return fromJson(root);
    } catch (IOException e) {
      throw new IllegalStateException("Failed to read " + resource, e);
    }
  }

  private static StaffMarketBands fromJson(JsonNode root) {
    var roles = root.get("roles");
    if (roles == null || roles.isMissingNode()) {
      throw new IllegalStateException("staff-market.json missing roles");
    }
    var lengths = new EnumMap<CandidateKind, ContractLengthBand>(CandidateKind.class);
    var guarantees = new EnumMap<CandidateKind, GuaranteePctBand>(CandidateKind.class);
    var salaries = new EnumMap<CandidateKind, SalaryBand>(CandidateKind.class);
    for (var kind : CandidateKind.values()) {
      var roleNode = roles.get(kind.name());
      if (roleNode == null || roleNode.isMissingNode()) {
        throw new IllegalStateException("staff-market.json missing roles entry for " + kind.name());
      }
      lengths.put(kind, parseLength(roleNode.get("contract_length_years"), kind));
      guarantees.put(kind, parseGuarantee(roleNode.get("guarantee_pct"), kind));
      salaries.put(kind, parseSalary(roleNode.get("salary_annual_usd"), kind));
    }
    return new StaffMarketBands(lengths, guarantees, salaries);
  }

  private static ContractLengthBand parseLength(JsonNode node, CandidateKind kind) {
    if (node == null || node.isMissingNode()) {
      throw new IllegalStateException("missing contract_length_years for " + kind);
    }
    return new ContractLengthBand(
        node.get("min").asInt(), node.get("mode").asInt(), node.get("max").asInt());
  }

  private static GuaranteePctBand parseGuarantee(JsonNode node, CandidateKind kind) {
    if (node == null || node.isMissingNode()) {
      throw new IllegalStateException("missing guarantee_pct for " + kind);
    }
    return new GuaranteePctBand(
        node.get("min").asDouble(), node.get("typical").asDouble(), node.get("max").asDouble());
  }

  private static SalaryBand parseSalary(JsonNode node, CandidateKind kind) {
    if (node == null || node.isMissingNode()) {
      throw new IllegalStateException("missing salary_annual_usd for " + kind);
    }
    return new SalaryBand(
        node.get("p10").asLong(),
        node.get("p50").asLong(),
        node.get("p90").asLong(),
        node.get("ceiling").asLong());
  }

  /**
   * @return contract-length band (years: min / mode / max) for the given role. Never null; every
   *     {@link CandidateKind} has an entry.
   */
  ContractLengthBand contractLengthFor(CandidateKind role) {
    Objects.requireNonNull(role, "role");
    return contractLengths.get(role);
  }

  /**
   * @return guarantee-percentage band (min / typical / max, as a fraction of total contract value)
   *     for the given role.
   */
  GuaranteePctBand guaranteePctFor(CandidateKind role) {
    Objects.requireNonNull(role, "role");
    return guaranteePcts.get(role);
  }

  /**
   * @return salary band (annual USD dollars at p10 / p50 / p90 / ceiling) for the given role.
   *     Dollars, not cents — convert at the boundary where cents are needed.
   */
  SalaryBand salaryFor(CandidateKind role) {
    Objects.requireNonNull(role, "role");
    return salaries.get(role);
  }
}
