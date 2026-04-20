package app.zoneblitz.league.hiring;

import static app.zoneblitz.jooq.Tables.CANDIDATE_OFFERS;
import static app.zoneblitz.jooq.Tables.STAFF_CONTRACTS;
import static app.zoneblitz.jooq.Tables.TEAMS;

import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
class JooqStaffBudgetRepository implements StaffBudgetRepository {

  private final DSLContext dsl;

  JooqStaffBudgetRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public StaffBudget committed(long teamId, int season) {
    var budgetCents =
        dsl.select(TEAMS.STAFF_BUDGET_CENTS)
            .from(TEAMS)
            .where(TEAMS.ID.eq(teamId))
            .fetchOptional(TEAMS.STAFF_BUDGET_CENTS)
            .orElse(0L);

    var contractApy = sumActiveContractApy(teamId, season);
    var offerApy = sumOutstandingOfferApy(teamId);
    var deadCap = sumDeadCap(teamId, season);

    return new StaffBudget(teamId, season, budgetCents, contractApy + offerApy + deadCap);
  }

  private long sumActiveContractApy(long teamId, int season) {
    return dsl
        .selectFrom(STAFF_CONTRACTS)
        .where(STAFF_CONTRACTS.TEAM_ID.eq(teamId))
        .and(STAFF_CONTRACTS.START_SEASON.le(season))
        .and(STAFF_CONTRACTS.END_SEASON.ge(season))
        .and(
            STAFF_CONTRACTS
                .TERMINATED_AT_SEASON
                .isNull()
                .or(STAFF_CONTRACTS.TERMINATED_AT_SEASON.ge(season)))
        .fetch(STAFF_CONTRACTS.APY_CENTS)
        .stream()
        .mapToLong(Long::longValue)
        .sum();
  }

  private long sumOutstandingOfferApy(long teamId) {
    var termsJsons =
        dsl.select(CANDIDATE_OFFERS.TERMS)
            .from(CANDIDATE_OFFERS)
            .where(CANDIDATE_OFFERS.TEAM_ID.eq(teamId))
            .and(
                CANDIDATE_OFFERS
                    .STATUS
                    .eq(OfferStatus.ACTIVE.name())
                    .or(CANDIDATE_OFFERS.STATUS.eq(OfferStatus.COUNTER_PENDING.name())))
            .fetch(CANDIDATE_OFFERS.TERMS);
    long total = 0L;
    for (var jsonb : termsJsons) {
      var terms = OfferTermsJson.fromJson(jsonb.data());
      total += terms.compensation().movePointRight(2).longValueExact();
    }
    return total;
  }

  private long sumDeadCap(long teamId, int season) {
    var terminated =
        dsl.select(
                STAFF_CONTRACTS.GUARANTEE_CENTS,
                STAFF_CONTRACTS.CONTRACT_YEARS,
                STAFF_CONTRACTS.END_SEASON,
                STAFF_CONTRACTS.TERMINATED_AT_SEASON)
            .from(STAFF_CONTRACTS)
            .where(STAFF_CONTRACTS.TEAM_ID.eq(teamId))
            .and(STAFF_CONTRACTS.TERMINATED_AT_SEASON.isNotNull())
            .fetch();
    long total = 0L;
    for (var r : terminated) {
      var terminatedAt = r.get(STAFF_CONTRACTS.TERMINATED_AT_SEASON);
      var endSeason = r.get(STAFF_CONTRACTS.END_SEASON);
      if (season > terminatedAt && season <= endSeason) {
        var guarantee = r.get(STAFF_CONTRACTS.GUARANTEE_CENTS);
        var years = r.get(STAFF_CONTRACTS.CONTRACT_YEARS);
        total += guarantee / years;
      }
    }
    return total;
  }
}
