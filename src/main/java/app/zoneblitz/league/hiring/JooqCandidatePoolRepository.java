package app.zoneblitz.league;

import static app.zoneblitz.jooq.Tables.CANDIDATE_POOLS;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
class JooqCandidatePoolRepository implements CandidatePoolRepository {

  private final DSLContext dsl;

  JooqCandidatePoolRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public CandidatePool insert(long leagueId, LeaguePhase phase, CandidatePoolType type) {
    Objects.requireNonNull(phase, "phase");
    Objects.requireNonNull(type, "type");
    var record =
        dsl.insertInto(CANDIDATE_POOLS)
            .set(CANDIDATE_POOLS.LEAGUE_ID, leagueId)
            .set(CANDIDATE_POOLS.PHASE, phase.name())
            .set(CANDIDATE_POOLS.CANDIDATE_TYPE, type.name())
            .returning(
                CANDIDATE_POOLS.ID,
                CANDIDATE_POOLS.LEAGUE_ID,
                CANDIDATE_POOLS.PHASE,
                CANDIDATE_POOLS.CANDIDATE_TYPE,
                CANDIDATE_POOLS.GENERATED_AT)
            .fetchOne();
    return map(record);
  }

  @Override
  public Optional<CandidatePool> findById(long id) {
    return dsl.selectFrom(CANDIDATE_POOLS)
        .where(CANDIDATE_POOLS.ID.eq(id))
        .fetchOptional(this::map);
  }

  @Override
  public Optional<CandidatePool> findByLeaguePhaseAndType(
      long leagueId, LeaguePhase phase, CandidatePoolType type) {
    return dsl.selectFrom(CANDIDATE_POOLS)
        .where(CANDIDATE_POOLS.LEAGUE_ID.eq(leagueId))
        .and(CANDIDATE_POOLS.PHASE.eq(phase.name()))
        .and(CANDIDATE_POOLS.CANDIDATE_TYPE.eq(type.name()))
        .fetchOptional(this::map);
  }

  @Override
  public List<CandidatePool> findAllForLeague(long leagueId) {
    return dsl.selectFrom(CANDIDATE_POOLS)
        .where(CANDIDATE_POOLS.LEAGUE_ID.eq(leagueId))
        .orderBy(CANDIDATE_POOLS.GENERATED_AT.desc())
        .fetch(this::map);
  }

  private CandidatePool map(org.jooq.Record r) {
    return new CandidatePool(
        r.get(CANDIDATE_POOLS.ID),
        r.get(CANDIDATE_POOLS.LEAGUE_ID),
        LeaguePhase.valueOf(r.get(CANDIDATE_POOLS.PHASE)),
        CandidatePoolType.valueOf(r.get(CANDIDATE_POOLS.CANDIDATE_TYPE)),
        r.get(CANDIDATE_POOLS.GENERATED_AT).toInstant());
  }
}
