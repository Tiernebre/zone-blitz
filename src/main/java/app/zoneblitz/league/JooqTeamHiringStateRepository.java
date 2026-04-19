package app.zoneblitz.league;

import static app.zoneblitz.jooq.Tables.TEAMS;
import static app.zoneblitz.jooq.Tables.TEAM_HIRING_STATES;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Repository;

@Repository
class JooqTeamHiringStateRepository implements TeamHiringStateRepository {

  private final DSLContext dsl;

  JooqTeamHiringStateRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public TeamHiringState upsert(TeamHiringState state) {
    Objects.requireNonNull(state, "state");
    var shortlistJson = JSONB.valueOf(JsonLongArrays.encode(state.shortlist()));
    var interviewingJson = JSONB.valueOf(JsonLongArrays.encode(state.interviewingCandidateIds()));
    var record =
        dsl.insertInto(TEAM_HIRING_STATES)
            .set(TEAM_HIRING_STATES.TEAM_ID, state.teamId())
            .set(TEAM_HIRING_STATES.PHASE, state.phase().name())
            .set(TEAM_HIRING_STATES.STEP, state.step().name())
            .set(TEAM_HIRING_STATES.SHORTLIST, shortlistJson)
            .set(TEAM_HIRING_STATES.INTERVIEWING_CANDIDATE_IDS, interviewingJson)
            .onConflict(TEAM_HIRING_STATES.TEAM_ID, TEAM_HIRING_STATES.PHASE)
            .doUpdate()
            .set(TEAM_HIRING_STATES.STEP, state.step().name())
            .set(TEAM_HIRING_STATES.SHORTLIST, shortlistJson)
            .set(TEAM_HIRING_STATES.INTERVIEWING_CANDIDATE_IDS, interviewingJson)
            .returning(TEAM_HIRING_STATES.fields())
            .fetchOne();
    return map(record);
  }

  @Override
  public Optional<TeamHiringState> find(long teamId, LeaguePhase phase) {
    return dsl.selectFrom(TEAM_HIRING_STATES)
        .where(TEAM_HIRING_STATES.TEAM_ID.eq(teamId))
        .and(TEAM_HIRING_STATES.PHASE.eq(phase.name()))
        .fetchOptional(this::map);
  }

  @Override
  public List<TeamHiringState> findAllForLeaguePhase(long leagueId, LeaguePhase phase) {
    return dsl.select(TEAM_HIRING_STATES.fields())
        .from(TEAM_HIRING_STATES)
        .join(TEAMS)
        .on(TEAMS.ID.eq(TEAM_HIRING_STATES.TEAM_ID))
        .where(TEAMS.LEAGUE_ID.eq(leagueId))
        .and(TEAM_HIRING_STATES.PHASE.eq(phase.name()))
        .orderBy(TEAM_HIRING_STATES.TEAM_ID.asc())
        .fetch(this::map);
  }

  private TeamHiringState map(org.jooq.Record r) {
    return new TeamHiringState(
        r.get(TEAM_HIRING_STATES.ID),
        r.get(TEAM_HIRING_STATES.TEAM_ID),
        LeaguePhase.valueOf(r.get(TEAM_HIRING_STATES.PHASE)),
        HiringStep.valueOf(r.get(TEAM_HIRING_STATES.STEP)),
        JsonLongArrays.decode(r.get(TEAM_HIRING_STATES.SHORTLIST).data()),
        JsonLongArrays.decode(r.get(TEAM_HIRING_STATES.INTERVIEWING_CANDIDATE_IDS).data()));
  }
}
