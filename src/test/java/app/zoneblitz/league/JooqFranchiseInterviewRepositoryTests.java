package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.support.PostgresTestcontainer;
import java.math.BigDecimal;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

@JooqTest
@Import(PostgresTestcontainer.class)
class JooqFranchiseInterviewRepositoryTests {

  @Autowired DSLContext dsl;

  private FranchiseInterviewRepository interviews;
  private long leagueId;
  private long franchiseId;
  private long otherFranchiseId;
  private long candidateId;

  @BeforeEach
  void setUp() {
    interviews = new JooqFranchiseInterviewRepository(dsl);
    var leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var pools = new JooqCandidatePoolRepository(dsl);
    var candidates = new JooqCandidateRepository(dsl);
    var league =
        leagues.insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());
    leagueId = league.id();
    var listed = franchises.listAll();
    franchiseId = listed.get(0).id();
    otherFranchiseId = listed.get(1).id();
    var pool = pools.insert(leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    candidateId = candidates.insert(CandidateTestData.newHeadCoach(pool.id())).id();
  }

  @Test
  void insert_roundTripsAllFields() {
    var inserted =
        interviews.insert(
            new NewFranchiseInterview(
                leagueId,
                franchiseId,
                candidateId,
                LeaguePhase.HIRING_HEAD_COACH,
                1,
                1,
                new BigDecimal("76.50")));

    assertThat(inserted.id()).isPositive();
    assertThat(inserted.leagueId()).isEqualTo(leagueId);
    assertThat(inserted.franchiseId()).isEqualTo(franchiseId);
    assertThat(inserted.candidateId()).isEqualTo(candidateId);
    assertThat(inserted.phase()).isEqualTo(LeaguePhase.HIRING_HEAD_COACH);
    assertThat(inserted.phaseWeek()).isEqualTo(1);
    assertThat(inserted.interviewIndex()).isEqualTo(1);
    assertThat(inserted.scoutedOverall()).isEqualByComparingTo("76.50");
  }

  @Test
  void countForCandidate_returnsPerFranchisePerCandidateTotal() {
    interviews.insert(interview(franchiseId, candidateId, 1, 1));
    interviews.insert(interview(franchiseId, candidateId, 1, 2));
    interviews.insert(interview(otherFranchiseId, candidateId, 1, 1));

    assertThat(
            interviews.countForCandidate(
                leagueId, franchiseId, candidateId, LeaguePhase.HIRING_HEAD_COACH))
        .isEqualTo(2);
    assertThat(
            interviews.countForCandidate(
                leagueId, otherFranchiseId, candidateId, LeaguePhase.HIRING_HEAD_COACH))
        .isEqualTo(1);
  }

  @Test
  void countForWeek_isScopedToWeek() {
    interviews.insert(interview(franchiseId, candidateId, 1, 1));
    interviews.insert(interview(franchiseId, candidateId, 1, 2));
    interviews.insert(interview(franchiseId, candidateId, 2, 3));

    assertThat(interviews.countForWeek(leagueId, franchiseId, LeaguePhase.HIRING_HEAD_COACH, 1))
        .isEqualTo(2);
    assertThat(interviews.countForWeek(leagueId, franchiseId, LeaguePhase.HIRING_HEAD_COACH, 2))
        .isEqualTo(1);
    assertThat(interviews.countForWeek(leagueId, franchiseId, LeaguePhase.HIRING_HEAD_COACH, 3))
        .isZero();
  }

  @Test
  void findAllFor_orderedByIdAscending() {
    interviews.insert(interview(franchiseId, candidateId, 1, 1));
    interviews.insert(interview(franchiseId, candidateId, 1, 2));
    interviews.insert(interview(otherFranchiseId, candidateId, 1, 1));

    var mine = interviews.findAllFor(leagueId, franchiseId, LeaguePhase.HIRING_HEAD_COACH);

    assertThat(mine).extracting(FranchiseInterview::interviewIndex).containsExactly(1, 2);
  }

  private NewFranchiseInterview interview(long franchise, long candidate, int week, int index) {
    return new NewFranchiseInterview(
        leagueId,
        franchise,
        candidate,
        LeaguePhase.HIRING_HEAD_COACH,
        week,
        index,
        new BigDecimal("70.00"));
  }
}
