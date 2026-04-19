package app.zoneblitz.league;

import static app.zoneblitz.jooq.Tables.FRANCHISE_STAFF;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
class JooqFranchiseStaffRepository implements FranchiseStaffRepository {

  private final DSLContext dsl;

  JooqFranchiseStaffRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public FranchiseStaffMember insert(NewFranchiseStaffMember hire) {
    Objects.requireNonNull(hire, "hire");
    var record =
        dsl.insertInto(FRANCHISE_STAFF)
            .set(FRANCHISE_STAFF.LEAGUE_ID, hire.leagueId())
            .set(FRANCHISE_STAFF.FRANCHISE_ID, hire.franchiseId())
            .set(FRANCHISE_STAFF.CANDIDATE_ID, hire.candidateId())
            .set(FRANCHISE_STAFF.ROLE, hire.role().name())
            .set(FRANCHISE_STAFF.SCOUT_BRANCH, hire.scoutBranch().map(Enum::name).orElse(null))
            .set(FRANCHISE_STAFF.HIRED_AT_PHASE, hire.hiredAtPhase().name())
            .set(FRANCHISE_STAFF.HIRED_AT_WEEK, hire.hiredAtWeek())
            .returning(FRANCHISE_STAFF.fields())
            .fetchOne();
    return map(record);
  }

  @Override
  public Optional<FranchiseStaffMember> findById(long id) {
    return dsl.selectFrom(FRANCHISE_STAFF)
        .where(FRANCHISE_STAFF.ID.eq(id))
        .fetchOptional(this::map);
  }

  @Override
  public List<FranchiseStaffMember> findAllForFranchise(long leagueId, long franchiseId) {
    return dsl.selectFrom(FRANCHISE_STAFF)
        .where(FRANCHISE_STAFF.LEAGUE_ID.eq(leagueId))
        .and(FRANCHISE_STAFF.FRANCHISE_ID.eq(franchiseId))
        .orderBy(FRANCHISE_STAFF.ROLE.asc(), FRANCHISE_STAFF.ID.asc())
        .fetch(this::map);
  }

  private FranchiseStaffMember map(org.jooq.Record r) {
    return new FranchiseStaffMember(
        r.get(FRANCHISE_STAFF.ID),
        r.get(FRANCHISE_STAFF.LEAGUE_ID),
        r.get(FRANCHISE_STAFF.FRANCHISE_ID),
        r.get(FRANCHISE_STAFF.CANDIDATE_ID),
        StaffRole.valueOf(r.get(FRANCHISE_STAFF.ROLE)),
        Optional.ofNullable(r.get(FRANCHISE_STAFF.SCOUT_BRANCH)).map(ScoutBranch::valueOf),
        LeaguePhase.valueOf(r.get(FRANCHISE_STAFF.HIRED_AT_PHASE)),
        r.get(FRANCHISE_STAFF.HIRED_AT_WEEK),
        r.get(FRANCHISE_STAFF.HIRED_AT).toInstant());
  }
}
