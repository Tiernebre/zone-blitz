package app.zoneblitz.league;

import static app.zoneblitz.jooq.Tables.FRANCHISE_HIRING_STATES;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Repository;

@Repository
class JooqFranchiseHiringStateRepository implements FranchiseHiringStateRepository {

  private final DSLContext dsl;

  JooqFranchiseHiringStateRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public FranchiseHiringState upsert(FranchiseHiringState state) {
    Objects.requireNonNull(state, "state");
    var shortlistJson = JSONB.valueOf(JsonLongArrays.encode(state.shortlist()));
    var interviewingJson = JSONB.valueOf(JsonLongArrays.encode(state.interviewingCandidateIds()));
    var record =
        dsl.insertInto(FRANCHISE_HIRING_STATES)
            .set(FRANCHISE_HIRING_STATES.LEAGUE_ID, state.leagueId())
            .set(FRANCHISE_HIRING_STATES.FRANCHISE_ID, state.franchiseId())
            .set(FRANCHISE_HIRING_STATES.PHASE, state.phase().name())
            .set(FRANCHISE_HIRING_STATES.STEP, state.step().name())
            .set(FRANCHISE_HIRING_STATES.SHORTLIST, shortlistJson)
            .set(FRANCHISE_HIRING_STATES.INTERVIEWING_CANDIDATE_IDS, interviewingJson)
            .onConflict(
                FRANCHISE_HIRING_STATES.LEAGUE_ID,
                FRANCHISE_HIRING_STATES.FRANCHISE_ID,
                FRANCHISE_HIRING_STATES.PHASE)
            .doUpdate()
            .set(FRANCHISE_HIRING_STATES.STEP, state.step().name())
            .set(FRANCHISE_HIRING_STATES.SHORTLIST, shortlistJson)
            .set(FRANCHISE_HIRING_STATES.INTERVIEWING_CANDIDATE_IDS, interviewingJson)
            .returning(FRANCHISE_HIRING_STATES.fields())
            .fetchOne();
    return map(record);
  }

  @Override
  public Optional<FranchiseHiringState> find(long leagueId, long franchiseId, LeaguePhase phase) {
    return dsl.selectFrom(FRANCHISE_HIRING_STATES)
        .where(FRANCHISE_HIRING_STATES.LEAGUE_ID.eq(leagueId))
        .and(FRANCHISE_HIRING_STATES.FRANCHISE_ID.eq(franchiseId))
        .and(FRANCHISE_HIRING_STATES.PHASE.eq(phase.name()))
        .fetchOptional(this::map);
  }

  @Override
  public List<FranchiseHiringState> findAllForLeaguePhase(long leagueId, LeaguePhase phase) {
    return dsl.selectFrom(FRANCHISE_HIRING_STATES)
        .where(FRANCHISE_HIRING_STATES.LEAGUE_ID.eq(leagueId))
        .and(FRANCHISE_HIRING_STATES.PHASE.eq(phase.name()))
        .orderBy(FRANCHISE_HIRING_STATES.FRANCHISE_ID.asc())
        .fetch(this::map);
  }

  private FranchiseHiringState map(org.jooq.Record r) {
    return new FranchiseHiringState(
        r.get(FRANCHISE_HIRING_STATES.ID),
        r.get(FRANCHISE_HIRING_STATES.LEAGUE_ID),
        r.get(FRANCHISE_HIRING_STATES.FRANCHISE_ID),
        LeaguePhase.valueOf(r.get(FRANCHISE_HIRING_STATES.PHASE)),
        HiringStep.valueOf(r.get(FRANCHISE_HIRING_STATES.STEP)),
        JsonLongArrays.decode(r.get(FRANCHISE_HIRING_STATES.SHORTLIST).data()),
        JsonLongArrays.decode(r.get(FRANCHISE_HIRING_STATES.INTERVIEWING_CANDIDATE_IDS).data()));
  }
}
