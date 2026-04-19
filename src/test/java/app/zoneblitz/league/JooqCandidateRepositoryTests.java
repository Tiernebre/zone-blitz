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
class JooqCandidateRepositoryTests {

  @Autowired DSLContext dsl;

  private CandidateRepository candidates;
  private CandidatePoolRepository pools;
  private LeagueRepository leagues;
  private FranchiseRepository franchises;

  private long poolId;

  @BeforeEach
  void setUp() {
    candidates = new JooqCandidateRepository(dsl);
    pools = new JooqCandidatePoolRepository(dsl);
    leagues = new JooqLeagueRepository(dsl);
    franchises = new JooqFranchiseRepository(dsl);
    var league =
        leagues.insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());
    poolId =
        pools.insert(league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH).id();
  }

  @Test
  void insert_roundTripsAllFields() {
    var candidate = candidates.insert(CandidateTestData.newHeadCoach(poolId));

    assertThat(candidate.id()).isPositive();
    assertThat(candidate.poolId()).isEqualTo(poolId);
    assertThat(candidate.kind()).isEqualTo(CandidateKind.HEAD_COACH);
    assertThat(candidate.specialtyPosition()).isEqualTo(SpecialtyPosition.QB);
    assertThat(candidate.archetype()).isEqualTo(CandidateArchetype.OFFENSIVE_PLAY_CALLER);
    assertThat(candidate.age()).isEqualTo(43);
    assertThat(candidate.totalExperienceYears()).isEqualTo(18);
    assertThat(candidate.experienceByRole()).contains("\"OC\"").contains("10");
    assertThat(candidate.hiddenAttrs()).contains("true_rating");
    assertThat(candidate.scoutedAttrs()).contains("scouted_rating");
    assertThat(candidate.hiredByFranchiseId()).isEmpty();
    assertThat(candidate.scoutBranch()).isEmpty();
  }

  @Test
  void insert_scout_populatesScoutBranch() {
    var scout = candidates.insert(CandidateTestData.newScout(poolId, ScoutBranch.COLLEGE));

    assertThat(scout.scoutBranch()).hasValue(ScoutBranch.COLLEGE);
  }

  @Test
  void findById_whenMissing_returnsEmpty() {
    assertThat(candidates.findById(999_999L)).isEmpty();
  }

  @Test
  void findAllByPoolId_returnsCandidatesInInsertionOrder() {
    var first = candidates.insert(CandidateTestData.newHeadCoach(poolId));
    var second = candidates.insert(CandidateTestData.newHeadCoach(poolId));

    assertThat(candidates.findAllByPoolId(poolId))
        .extracting(Candidate::id)
        .containsExactly(first.id(), second.id());
  }

  @Test
  void markHired_setsFranchiseIdAndPersists() {
    var candidate = candidates.insert(CandidateTestData.newHeadCoach(poolId));
    var franchiseId = franchises.listAll().getFirst().id();

    assertThat(candidates.markHired(candidate.id(), franchiseId)).isTrue();

    var reloaded = candidates.findById(candidate.id()).orElseThrow();
    assertThat(reloaded.hiredByFranchiseId()).hasValue(franchiseId);
  }

  @Test
  void markHired_whenMissing_returnsFalse() {
    assertThat(candidates.markHired(999_999L, franchises.listAll().getFirst().id())).isFalse();
  }
}
