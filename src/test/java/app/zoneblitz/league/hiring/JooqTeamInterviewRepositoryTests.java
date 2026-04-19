package app.zoneblitz.league.hiring;

import static app.zoneblitz.jooq.Tables.TEAMS;
import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.LeagueSettings;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.team.JooqTeamRepository;
import app.zoneblitz.league.team.TeamDraft;
import app.zoneblitz.support.PostgresTestcontainer;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

@JooqTest
@Import(PostgresTestcontainer.class)
class JooqTeamInterviewRepositoryTests {

  @Autowired DSLContext dsl;

  private TeamInterviewRepository interviews;
  private long teamId;
  private long otherTeamId;
  private long candidateId;

  @BeforeEach
  void setUp() {
    interviews = new JooqTeamInterviewRepository(dsl);
    var leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    var pools = new JooqCandidatePoolRepository(dsl);
    var candidates = new JooqCandidateRepository(dsl);
    var league =
        leagues.insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());
    var listed = franchises.listAll();
    teamRepo.insertAll(
        league.id(),
        List.of(
            new TeamDraft(listed.get(0).id(), Optional.of("sub-1")),
            new TeamDraft(listed.get(1).id(), Optional.empty())));
    var teamIds =
        dsl.select(TEAMS.ID)
            .from(TEAMS)
            .where(TEAMS.LEAGUE_ID.eq(league.id()))
            .orderBy(TEAMS.ID.asc())
            .fetch(TEAMS.ID);
    teamId = teamIds.get(0);
    otherTeamId = teamIds.get(1);
    var pool =
        pools.insert(league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    candidateId = candidates.insert(CandidateTestData.newHeadCoach(pool.id())).id();
  }

  @Test
  void insert_roundTripsAllFields() {
    var inserted =
        interviews.insert(
            new NewTeamInterview(
                teamId, candidateId, LeaguePhase.HIRING_HEAD_COACH, 1, 1, new BigDecimal("76.50")));

    assertThat(inserted.id()).isPositive();
    assertThat(inserted.teamId()).isEqualTo(teamId);
    assertThat(inserted.candidateId()).isEqualTo(candidateId);
    assertThat(inserted.phase()).isEqualTo(LeaguePhase.HIRING_HEAD_COACH);
    assertThat(inserted.phaseWeek()).isEqualTo(1);
    assertThat(inserted.interviewIndex()).isEqualTo(1);
    assertThat(inserted.scoutedOverall()).isEqualByComparingTo("76.50");
  }

  @Test
  void countForCandidate_returnsPerTeamPerCandidateTotal() {
    interviews.insert(interview(teamId, candidateId, 1, 1));
    interviews.insert(interview(teamId, candidateId, 1, 2));
    interviews.insert(interview(otherTeamId, candidateId, 1, 1));

    assertThat(interviews.countForCandidate(teamId, candidateId, LeaguePhase.HIRING_HEAD_COACH))
        .isEqualTo(2);
    assertThat(
            interviews.countForCandidate(otherTeamId, candidateId, LeaguePhase.HIRING_HEAD_COACH))
        .isEqualTo(1);
  }

  @Test
  void countForWeek_isScopedToWeek() {
    interviews.insert(interview(teamId, candidateId, 1, 1));
    interviews.insert(interview(teamId, candidateId, 1, 2));
    interviews.insert(interview(teamId, candidateId, 2, 3));

    assertThat(interviews.countForWeek(teamId, LeaguePhase.HIRING_HEAD_COACH, 1)).isEqualTo(2);
    assertThat(interviews.countForWeek(teamId, LeaguePhase.HIRING_HEAD_COACH, 2)).isEqualTo(1);
    assertThat(interviews.countForWeek(teamId, LeaguePhase.HIRING_HEAD_COACH, 3)).isZero();
  }

  @Test
  void findAllFor_orderedByIdAscending() {
    interviews.insert(interview(teamId, candidateId, 1, 1));
    interviews.insert(interview(teamId, candidateId, 1, 2));
    interviews.insert(interview(otherTeamId, candidateId, 1, 1));

    var mine = interviews.findAllFor(teamId, LeaguePhase.HIRING_HEAD_COACH);

    assertThat(mine).extracting(TeamInterview::interviewIndex).containsExactly(1, 2);
  }

  private NewTeamInterview interview(long team, long candidate, int week, int index) {
    return new NewTeamInterview(
        team, candidate, LeaguePhase.HIRING_HEAD_COACH, week, index, new BigDecimal("70.00"));
  }
}
