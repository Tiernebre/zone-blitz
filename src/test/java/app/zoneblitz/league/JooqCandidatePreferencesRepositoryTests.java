package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.support.PostgresTestcontainer;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

@JooqTest
@Import(PostgresTestcontainer.class)
class JooqCandidatePreferencesRepositoryTests {

  @Autowired DSLContext dsl;

  private CandidatePreferencesRepository preferences;
  private CandidateRepository candidates;
  private long candidateId;

  @BeforeEach
  void setUp() {
    preferences = new JooqCandidatePreferencesRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    var leagues = new JooqLeagueRepository(dsl);
    var pools = new JooqCandidatePoolRepository(dsl);
    var league =
        leagues.insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());
    var pool =
        pools.insert(league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    candidateId = candidates.insert(CandidateTestData.newHeadCoach(pool.id())).id();
  }

  @Test
  void insert_thenFindByCandidateId_roundTripsAllDimensions() {
    var inserted = preferences.insert(CandidateTestData.preferencesFor(candidateId));

    var reloaded = preferences.findByCandidateId(candidateId).orElseThrow();
    assertThat(reloaded).isEqualTo(inserted);
    assertThat(reloaded.marketSizeTarget()).isEqualTo(MarketSize.LARGE);
    assertThat(reloaded.geographyTarget()).isEqualTo(Geography.NE);
    assertThat(reloaded.climateTarget()).isEqualTo(Climate.NEUTRAL);
    assertThat(reloaded.competitiveWindowTarget()).isEqualTo(CompetitiveWindow.CONTENDER);
    assertThat(reloaded.roleScopeTarget()).isEqualTo(RoleScope.HIGH);
    assertThat(reloaded.staffContinuityTarget()).isEqualTo(StaffContinuity.BRING_OWN);
    assertThat(reloaded.schemeAlignmentTarget()).isEqualTo("WEST_COAST");
  }

  @Test
  void findByCandidateId_whenMissing_returnsEmpty() {
    assertThat(preferences.findByCandidateId(999_999L)).isEmpty();
  }
}
