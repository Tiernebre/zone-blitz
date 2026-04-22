package app.zoneblitz.league.hiring.hire;

import static app.zoneblitz.jooq.Tables.STAFF_CONTRACTS;

import app.zoneblitz.league.hiring.StaffContract;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class JooqStaffContractRepository implements StaffContractRepository {

  private final DSLContext dsl;

  public JooqStaffContractRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public StaffContract insert(NewStaffContract contract) {
    Objects.requireNonNull(contract, "contract");
    var record =
        dsl.insertInto(STAFF_CONTRACTS)
            .set(STAFF_CONTRACTS.TEAM_ID, contract.teamId())
            .set(STAFF_CONTRACTS.CANDIDATE_ID, contract.candidateId())
            .set(STAFF_CONTRACTS.TEAM_STAFF_ID, contract.teamStaffId())
            .set(STAFF_CONTRACTS.APY_CENTS, contract.apyCents())
            .set(STAFF_CONTRACTS.GUARANTEE_CENTS, contract.guaranteeCents())
            .set(STAFF_CONTRACTS.CONTRACT_YEARS, contract.contractYears())
            .set(STAFF_CONTRACTS.START_SEASON, contract.startSeason())
            .set(STAFF_CONTRACTS.END_SEASON, contract.endSeason())
            .returning(STAFF_CONTRACTS.fields())
            .fetchOne();
    return map(record);
  }

  @Override
  public List<StaffContract> findActiveForTeam(long teamId) {
    return dsl.selectFrom(STAFF_CONTRACTS)
        .where(STAFF_CONTRACTS.TEAM_ID.eq(teamId))
        .and(STAFF_CONTRACTS.TERMINATED_AT_SEASON.isNull())
        .orderBy(STAFF_CONTRACTS.ID.asc())
        .fetch(this::map);
  }

  @Override
  public void terminate(long contractId, int atSeason) {
    dsl.update(STAFF_CONTRACTS)
        .set(STAFF_CONTRACTS.TERMINATED_AT_SEASON, atSeason)
        .where(STAFF_CONTRACTS.ID.eq(contractId))
        .and(STAFF_CONTRACTS.TERMINATED_AT_SEASON.isNull())
        .execute();
  }

  private StaffContract map(org.jooq.Record r) {
    return new StaffContract(
        r.get(STAFF_CONTRACTS.ID),
        r.get(STAFF_CONTRACTS.TEAM_ID),
        r.get(STAFF_CONTRACTS.CANDIDATE_ID),
        r.get(STAFF_CONTRACTS.TEAM_STAFF_ID),
        r.get(STAFF_CONTRACTS.APY_CENTS),
        r.get(STAFF_CONTRACTS.GUARANTEE_CENTS),
        r.get(STAFF_CONTRACTS.CONTRACT_YEARS),
        r.get(STAFF_CONTRACTS.START_SEASON),
        r.get(STAFF_CONTRACTS.END_SEASON),
        Optional.ofNullable(r.get(STAFF_CONTRACTS.TERMINATED_AT_SEASON)));
  }
}
