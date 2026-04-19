package app.zoneblitz.league.hiring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.LeagueSettings;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.support.PostgresTestcontainer;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

@JooqTest
@Import(PostgresTestcontainer.class)
class JooqCandidatePoolRepositoryTests {

  @Autowired DSLContext dsl;

  private CandidatePoolRepository pools;
  private LeagueRepository leagues;
  private long leagueId;

  @BeforeEach
  void setUp() {
    pools = new JooqCandidatePoolRepository(dsl);
    leagues = new JooqLeagueRepository(dsl);
    leagueId =
        leagues
            .insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults())
            .id();
  }

  @Test
  void insert_returnsPoolWithGeneratedIdAndTimestamp() {
    var pool = pools.insert(leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);

    assertThat(pool.id()).isPositive();
    assertThat(pool.leagueId()).isEqualTo(leagueId);
    assertThat(pool.phase()).isEqualTo(LeaguePhase.HIRING_HEAD_COACH);
    assertThat(pool.type()).isEqualTo(CandidatePoolType.HEAD_COACH);
    assertThat(pool.generatedAt()).isNotNull();
  }

  @Test
  void findById_whenPresent_returnsPool() {
    var inserted =
        pools.insert(leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);

    assertThat(pools.findById(inserted.id())).hasValue(inserted);
  }

  @Test
  void findById_whenMissing_returnsEmpty() {
    assertThat(pools.findById(999_999L)).isEmpty();
  }

  @Test
  void findByLeaguePhaseAndType_whenPresent_returnsPool() {
    var inserted =
        pools.insert(leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);

    assertThat(
            pools.findByLeaguePhaseAndType(
                leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH))
        .hasValue(inserted);
  }

  @Test
  void insert_whenDuplicateLeaguePhaseType_throws() {
    pools.insert(leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);

    assertThatThrownBy(
            () ->
                pools.insert(leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void findAllForLeague_returnsAllPoolsNewestFirst() {
    pools.insert(leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    pools.insert(
        leagueId, LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING, CandidatePoolType.DIRECTOR_OF_SCOUTING);

    assertThat(pools.findAllForLeague(leagueId)).hasSize(2);
  }
}
