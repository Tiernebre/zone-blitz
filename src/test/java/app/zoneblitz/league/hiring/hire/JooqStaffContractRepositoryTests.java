package app.zoneblitz.league.hiring.hire;

import static app.zoneblitz.jooq.Tables.TEAMS;
import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.LeagueSettings;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.CandidateTestData;
import app.zoneblitz.league.hiring.StaffContract;
import app.zoneblitz.league.hiring.candidates.JooqCandidatePoolRepository;
import app.zoneblitz.league.hiring.candidates.JooqCandidateRepository;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.staff.JooqTeamStaffRepository;
import app.zoneblitz.league.staff.NewTeamStaffMember;
import app.zoneblitz.league.staff.StaffRole;
import app.zoneblitz.league.team.JooqTeamRepository;
import app.zoneblitz.league.team.TeamDraft;
import app.zoneblitz.support.PostgresTestcontainer;
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
class JooqStaffContractRepositoryTests {

  @Autowired DSLContext dsl;

  private StaffContractRepository contracts;
  private long teamId;
  private long candidateId;
  private long teamStaffId;
  private long poolId;

  @BeforeEach
  void setUp() {
    contracts = new JooqStaffContractRepository(dsl);
    var leagues = new JooqLeagueRepository(dsl);
    var pools = new JooqCandidatePoolRepository(dsl);
    var candidateRepo = new JooqCandidateRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    var staffRepo = new JooqTeamStaffRepository(dsl);

    var league =
        leagues.insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());
    var pool =
        pools.insert(league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    poolId = pool.id();
    candidateId = candidateRepo.insert(CandidateTestData.newHeadCoach(pool.id())).id();
    var listed = franchises.listAll();
    teamRepo.insertAll(
        league.id(), List.of(new TeamDraft(listed.get(0).id(), Optional.of("sub-1"))), 0L);
    teamId =
        dsl.select(TEAMS.ID).from(TEAMS).where(TEAMS.LEAGUE_ID.eq(league.id())).fetchOne(TEAMS.ID);
    teamStaffId =
        staffRepo
            .insert(
                new NewTeamStaffMember(
                    teamId,
                    candidateId,
                    StaffRole.HEAD_COACH,
                    Optional.empty(),
                    LeaguePhase.HIRING_HEAD_COACH,
                    1))
            .id();
  }

  @Test
  void insert_validContract_persistsAllFields() {
    var contract =
        contracts.insert(
            new NewStaffContract(
                teamId, candidateId, teamStaffId, 8_500_000_00L, 42_500_000_00L, 5, 1, 5));

    assertThat(contract.id()).isPositive();
    assertThat(contract.teamId()).isEqualTo(teamId);
    assertThat(contract.candidateId()).isEqualTo(candidateId);
    assertThat(contract.teamStaffId()).isEqualTo(teamStaffId);
    assertThat(contract.apyCents()).isEqualTo(8_500_000_00L);
    assertThat(contract.guaranteeCents()).isEqualTo(42_500_000_00L);
    assertThat(contract.contractYears()).isEqualTo(5);
    assertThat(contract.startSeason()).isEqualTo(1);
    assertThat(contract.endSeason()).isEqualTo(5);
    assertThat(contract.terminatedAtSeason()).isEmpty();
  }

  @Test
  void findActiveForTeam_excludesTerminated() {
    var secondCandidate =
        new JooqCandidateRepository(dsl).insert(CandidateTestData.newHeadCoach(poolId));
    var secondStaff =
        new JooqTeamStaffRepository(dsl)
            .insert(
                new NewTeamStaffMember(
                    teamId,
                    secondCandidate.id(),
                    StaffRole.OFFENSIVE_COORDINATOR,
                    Optional.empty(),
                    LeaguePhase.HIRING_HEAD_COACH,
                    1))
            .id();
    var active =
        contracts.insert(
            new NewStaffContract(
                teamId, candidateId, teamStaffId, 8_500_000_00L, 8_500_000_00L, 5, 1, 5));
    var terminated =
        contracts.insert(
            new NewStaffContract(
                teamId, secondCandidate.id(), secondStaff, 2_000_000_00L, 1_000_000_00L, 3, 1, 3));
    contracts.terminate(terminated.id(), 2);

    var active_list = contracts.findActiveForTeam(teamId);

    assertThat(active_list).extracting(StaffContract::id).containsExactly(active.id());
  }

  @Test
  void terminate_setsTerminatedAtSeason() {
    var contract =
        contracts.insert(
            new NewStaffContract(
                teamId, candidateId, teamStaffId, 8_500_000_00L, 8_500_000_00L, 5, 1, 5));

    contracts.terminate(contract.id(), 3);

    var refetched =
        dsl.selectFrom(app.zoneblitz.jooq.Tables.STAFF_CONTRACTS)
            .where(app.zoneblitz.jooq.Tables.STAFF_CONTRACTS.ID.eq(contract.id()))
            .fetchOne();
    assertThat(refetched.getTerminatedAtSeason()).isEqualTo(3);
  }
}
