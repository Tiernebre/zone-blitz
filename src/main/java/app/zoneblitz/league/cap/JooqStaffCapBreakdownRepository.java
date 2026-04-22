package app.zoneblitz.league.cap;

import static app.zoneblitz.jooq.Tables.CANDIDATES;
import static app.zoneblitz.jooq.Tables.CANDIDATE_OFFERS;
import static app.zoneblitz.jooq.Tables.STAFF_CONTRACTS;
import static app.zoneblitz.jooq.Tables.TEAMS;
import static app.zoneblitz.jooq.Tables.TEAM_STAFF;

import app.zoneblitz.league.cap.StaffCapView.ContractLine;
import app.zoneblitz.league.cap.StaffCapView.DeadCapLine;
import app.zoneblitz.league.cap.StaffCapView.OfferLine;
import app.zoneblitz.league.staff.StaffRole;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
class JooqStaffCapBreakdownRepository implements StaffCapBreakdownRepository {

  private static final String ACTIVE = "ACTIVE";
  private static final String COUNTER_PENDING = "COUNTER_PENDING";
  private static final ObjectMapper JSON = new ObjectMapper();

  private final DSLContext dsl;

  JooqStaffCapBreakdownRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public StaffCapBreakdown breakdown(long teamId, int season) {
    var budgetCents =
        dsl.select(TEAMS.STAFF_BUDGET_CENTS)
            .from(TEAMS)
            .where(TEAMS.ID.eq(teamId))
            .fetchOptional(TEAMS.STAFF_BUDGET_CENTS)
            .orElse(0L);
    return new StaffCapBreakdown(
        budgetCents, contracts(teamId, season), offers(teamId), deadCap(teamId, season));
  }

  private List<ContractLine> contracts(long teamId, int season) {
    var rows =
        dsl.select(
                CANDIDATES.FIRST_NAME,
                CANDIDATES.LAST_NAME,
                TEAM_STAFF.ROLE,
                STAFF_CONTRACTS.APY_CENTS,
                STAFF_CONTRACTS.GUARANTEE_CENTS,
                STAFF_CONTRACTS.CONTRACT_YEARS,
                STAFF_CONTRACTS.START_SEASON,
                STAFF_CONTRACTS.END_SEASON)
            .from(STAFF_CONTRACTS)
            .join(CANDIDATES)
            .on(CANDIDATES.ID.eq(STAFF_CONTRACTS.CANDIDATE_ID))
            .join(TEAM_STAFF)
            .on(TEAM_STAFF.ID.eq(STAFF_CONTRACTS.TEAM_STAFF_ID))
            .where(STAFF_CONTRACTS.TEAM_ID.eq(teamId))
            .and(STAFF_CONTRACTS.START_SEASON.le(season))
            .and(STAFF_CONTRACTS.END_SEASON.ge(season))
            .and(
                STAFF_CONTRACTS
                    .TERMINATED_AT_SEASON
                    .isNull()
                    .or(STAFF_CONTRACTS.TERMINATED_AT_SEASON.ge(season)))
            .orderBy(STAFF_CONTRACTS.APY_CENTS.desc(), STAFF_CONTRACTS.ID.asc())
            .fetch();
    var out = new ArrayList<ContractLine>(rows.size());
    for (var r : rows) {
      out.add(
          new ContractLine(
              (r.get(CANDIDATES.FIRST_NAME) + " " + r.get(CANDIDATES.LAST_NAME)).trim(),
              roleDisplay(r.get(TEAM_STAFF.ROLE)),
              r.get(STAFF_CONTRACTS.APY_CENTS),
              r.get(STAFF_CONTRACTS.GUARANTEE_CENTS),
              r.get(STAFF_CONTRACTS.CONTRACT_YEARS),
              r.get(STAFF_CONTRACTS.START_SEASON),
              r.get(STAFF_CONTRACTS.END_SEASON)));
    }
    return List.copyOf(out);
  }

  private List<OfferLine> offers(long teamId) {
    var rows =
        dsl.select(
                CANDIDATES.FIRST_NAME,
                CANDIDATES.LAST_NAME,
                CANDIDATES.KIND,
                CANDIDATE_OFFERS.TERMS)
            .from(CANDIDATE_OFFERS)
            .join(CANDIDATES)
            .on(CANDIDATES.ID.eq(CANDIDATE_OFFERS.CANDIDATE_ID))
            .where(CANDIDATE_OFFERS.TEAM_ID.eq(teamId))
            .and(CANDIDATE_OFFERS.STATUS.in(ACTIVE, COUNTER_PENDING))
            .orderBy(CANDIDATE_OFFERS.ID.asc())
            .fetch();
    var out = new ArrayList<OfferLine>(rows.size());
    for (var r : rows) {
      var terms = parseTerms(r.get(CANDIDATE_OFFERS.TERMS).data());
      out.add(
          new OfferLine(
              (r.get(CANDIDATES.FIRST_NAME) + " " + r.get(CANDIDATES.LAST_NAME)).trim(),
              kindDisplay(r.get(CANDIDATES.KIND)),
              terms.compensationCents(),
              terms.contractLengthYears()));
    }
    return List.copyOf(out);
  }

  private List<DeadCapLine> deadCap(long teamId, int season) {
    var rows =
        dsl.select(
                CANDIDATES.FIRST_NAME,
                CANDIDATES.LAST_NAME,
                TEAM_STAFF.ROLE,
                STAFF_CONTRACTS.GUARANTEE_CENTS,
                STAFF_CONTRACTS.CONTRACT_YEARS,
                STAFF_CONTRACTS.END_SEASON,
                STAFF_CONTRACTS.TERMINATED_AT_SEASON)
            .from(STAFF_CONTRACTS)
            .join(CANDIDATES)
            .on(CANDIDATES.ID.eq(STAFF_CONTRACTS.CANDIDATE_ID))
            .join(TEAM_STAFF)
            .on(TEAM_STAFF.ID.eq(STAFF_CONTRACTS.TEAM_STAFF_ID))
            .where(STAFF_CONTRACTS.TEAM_ID.eq(teamId))
            .and(STAFF_CONTRACTS.TERMINATED_AT_SEASON.isNotNull())
            .and(STAFF_CONTRACTS.TERMINATED_AT_SEASON.lt(season))
            .and(STAFF_CONTRACTS.END_SEASON.ge(season))
            .orderBy(STAFF_CONTRACTS.ID.asc())
            .fetch();
    var out = new ArrayList<DeadCapLine>(rows.size());
    for (var r : rows) {
      var annual = r.get(STAFF_CONTRACTS.GUARANTEE_CENTS) / r.get(STAFF_CONTRACTS.CONTRACT_YEARS);
      out.add(
          new DeadCapLine(
              (r.get(CANDIDATES.FIRST_NAME) + " " + r.get(CANDIDATES.LAST_NAME)).trim(),
              roleDisplay(r.get(TEAM_STAFF.ROLE)),
              annual,
              r.get(STAFF_CONTRACTS.TERMINATED_AT_SEASON),
              r.get(STAFF_CONTRACTS.END_SEASON)));
    }
    return List.copyOf(out);
  }

  private static String roleDisplay(String role) {
    try {
      return StaffRole.valueOf(role).displayName();
    } catch (IllegalArgumentException e) {
      return role;
    }
  }

  private static String kindDisplay(String kind) {
    var parts = kind.split("_");
    var sb = new StringBuilder();
    for (int i = 0; i < parts.length; i++) {
      if (i > 0) sb.append(' ');
      var p = parts[i];
      sb.append(Character.toUpperCase(p.charAt(0))).append(p.substring(1).toLowerCase());
    }
    return sb.toString();
  }

  private static ParsedTerms parseTerms(String json) {
    try {
      JsonNode node = JSON.readTree(json);
      var compensation = new BigDecimal(node.get("compensation").asText());
      var years = node.get("contract_length_years").asInt();
      return new ParsedTerms(compensation.movePointRight(2).longValueExact(), years);
    } catch (IOException e) {
      throw new IllegalStateException("malformed offer terms JSON", e);
    }
  }

  private record ParsedTerms(long compensationCents, int contractLengthYears) {}
}
