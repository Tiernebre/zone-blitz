package app.zoneblitz.league.hiring.offer;

import app.zoneblitz.league.hiring.OfferTerms;
import app.zoneblitz.league.staff.RoleScope;
import app.zoneblitz.league.staff.StaffContinuity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.math.BigDecimal;

/**
 * JSON codec for {@link OfferTerms}. Used by repositories and use cases to round-trip the {@code
 * candidate_offers.terms} JSONB payload.
 */
public final class OfferTermsJson {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private OfferTermsJson() {}

  public static String toJson(OfferTerms terms) {
    var node = MAPPER.createObjectNode();
    node.put("compensation", terms.compensation());
    node.put("contract_length_years", terms.contractLengthYears());
    node.put("guaranteed_money_pct", terms.guaranteedMoneyPct());
    node.put("role_scope", terms.roleScope().name());
    node.put("staff_continuity", terms.staffContinuity().name());
    return node.toString();
  }

  public static OfferTerms fromJson(String json) {
    try {
      JsonNode node = MAPPER.readTree(json);
      return new OfferTerms(
          bigDecimalField(node, "compensation"),
          node.get("contract_length_years").asInt(),
          bigDecimalField(node, "guaranteed_money_pct"),
          RoleScope.valueOf(node.get("role_scope").asText()),
          StaffContinuity.valueOf(node.get("staff_continuity").asText()));
    } catch (IOException e) {
      throw new IllegalStateException("malformed offer terms JSON", e);
    }
  }

  private static BigDecimal bigDecimalField(JsonNode node, String field) {
    var n = node.get(field);
    if (n instanceof ObjectNode) {
      throw new IllegalStateException("expected scalar for " + field);
    }
    return new BigDecimal(n.asText());
  }
}
