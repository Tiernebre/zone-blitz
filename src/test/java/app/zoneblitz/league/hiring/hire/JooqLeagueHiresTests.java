package app.zoneblitz.league.hiring.hire;

import static app.zoneblitz.jooq.Tables.TEAMS;
import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.CreateLeagueResult;
import app.zoneblitz.league.CreateLeagueUseCase;
import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.CandidateTestData;
import app.zoneblitz.league.hiring.candidates.JooqCandidatePoolRepository;
import app.zoneblitz.league.hiring.candidates.JooqCandidateRepository;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.team.JooqTeamRepository;
import app.zoneblitz.support.PostgresTestcontainer;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

@JooqTest
@Import(PostgresTestcontainer.class)
class JooqLeagueHiresTests {

  @Autowired DSLContext dsl;

  private LeagueHires leagueHires;
  private JooqLeagueRepository leagues;
  private JooqCandidateRepository candidates;
  private JooqCandidatePoolRepository pools;
  private CreateLeagueUseCase createLeague;

  @BeforeEach
  void setUp() {
    leagueHires = new JooqLeagueHires(dsl);
    leagues = new JooqLeagueRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    pools = new JooqCandidatePoolRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    createLeague = new CreateLeagueUseCase(leagues, franchises, teamRepo);
  }

  @Test
  void forLeaguePool_returnsOneRowPerTeamWithViewerFirst_noHiresYet() {
    var created =
        (CreateLeagueResult.Created) createLeague.create("sub-1", "Dynasty", anyFranchise());
    var leagueId = created.league().id();
    var userTeamId = userTeamId(leagueId);
    var pool = pools.insert(leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);

    var board = leagueHires.forLeaguePool(leagueId, userTeamId, pool.id());

    assertThat(board).hasSizeGreaterThan(1);
    assertThat(board.getFirst().isViewerTeam()).isTrue();
    assertThat(board.getFirst().teamId()).isEqualTo(userTeamId);
    assertThat(board).allSatisfy(r -> assertThat(r.hire()).isEmpty());
  }

  @Test
  void forLeaguePool_surfacesHiredCandidateForCpuTeam() {
    var created =
        (CreateLeagueResult.Created) createLeague.create("sub-1", "Dynasty", anyFranchise());
    var leagueId = created.league().id();
    var userTeamId = userTeamId(leagueId);
    var cpuTeamId = otherTeamId(leagueId, userTeamId);
    var pool = pools.insert(leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    var candidate = candidates.insert(CandidateTestData.newHeadCoach(pool.id()));
    candidates.markHired(candidate.id(), cpuTeamId);

    var board = leagueHires.forLeaguePool(leagueId, userTeamId, pool.id());

    var cpuRow = board.stream().filter(r -> r.teamId() == cpuTeamId).findFirst().orElseThrow();
    assertThat(cpuRow.hire()).isPresent();
    assertThat(cpuRow.hire().orElseThrow().name()).isEqualTo(candidate.fullName());
    assertThat(cpuRow.isViewerTeam()).isFalse();
  }

  private long anyFranchise() {
    return new JooqFranchiseRepository(dsl).listAll().getFirst().id();
  }

  private long userTeamId(long leagueId) {
    return dsl.select(TEAMS.ID)
        .from(TEAMS)
        .where(TEAMS.LEAGUE_ID.eq(leagueId).and(TEAMS.OWNER_SUBJECT.isNotNull()))
        .fetchOne(TEAMS.ID);
  }

  private long otherTeamId(long leagueId, long excludeTeamId) {
    return dsl.select(TEAMS.ID)
        .from(TEAMS)
        .where(TEAMS.LEAGUE_ID.eq(leagueId).and(TEAMS.ID.ne(excludeTeamId)))
        .orderBy(TEAMS.ID.asc())
        .limit(1)
        .fetchOne(TEAMS.ID);
  }
}
