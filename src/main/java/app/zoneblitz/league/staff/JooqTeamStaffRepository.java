package app.zoneblitz.league.staff;

import static app.zoneblitz.jooq.Tables.TEAM_STAFF;

import app.zoneblitz.league.hiring.ScoutBranch;
import app.zoneblitz.league.phase.LeaguePhase;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class JooqTeamStaffRepository implements TeamStaffRepository {

  private final DSLContext dsl;

  public JooqTeamStaffRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public TeamStaffMember insert(NewTeamStaffMember hire) {
    Objects.requireNonNull(hire, "hire");
    var record =
        dsl.insertInto(TEAM_STAFF)
            .set(TEAM_STAFF.TEAM_ID, hire.teamId())
            .set(TEAM_STAFF.CANDIDATE_ID, hire.candidateId())
            .set(TEAM_STAFF.ROLE, hire.role().name())
            .set(TEAM_STAFF.SCOUT_BRANCH, hire.scoutBranch().map(Enum::name).orElse(null))
            .set(TEAM_STAFF.HIRED_AT_PHASE, hire.hiredAtPhase().name())
            .set(TEAM_STAFF.HIRED_AT_DAY, hire.hiredAtDay())
            .returning(TEAM_STAFF.fields())
            .fetchOne();
    return map(record);
  }

  @Override
  public Optional<TeamStaffMember> findById(long id) {
    return dsl.selectFrom(TEAM_STAFF).where(TEAM_STAFF.ID.eq(id)).fetchOptional(this::map);
  }

  @Override
  public List<TeamStaffMember> findAllForTeam(long teamId) {
    return dsl.selectFrom(TEAM_STAFF)
        .where(TEAM_STAFF.TEAM_ID.eq(teamId))
        .orderBy(TEAM_STAFF.ROLE.asc(), TEAM_STAFF.ID.asc())
        .fetch(this::map);
  }

  private TeamStaffMember map(org.jooq.Record r) {
    return new TeamStaffMember(
        r.get(TEAM_STAFF.ID),
        r.get(TEAM_STAFF.TEAM_ID),
        r.get(TEAM_STAFF.CANDIDATE_ID),
        StaffRole.valueOf(r.get(TEAM_STAFF.ROLE)),
        Optional.ofNullable(r.get(TEAM_STAFF.SCOUT_BRANCH)).map(ScoutBranch::valueOf),
        LeaguePhase.valueOf(r.get(TEAM_STAFF.HIRED_AT_PHASE)),
        r.get(TEAM_STAFF.HIRED_AT_DAY),
        r.get(TEAM_STAFF.HIRED_AT).toInstant());
  }
}
