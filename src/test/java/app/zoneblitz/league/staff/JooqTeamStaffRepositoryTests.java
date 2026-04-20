package app.zoneblitz.league.staff;

import static app.zoneblitz.jooq.Tables.TEAMS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.LeagueSettings;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.CandidateRepository;
import app.zoneblitz.league.hiring.CandidateTestData;
import app.zoneblitz.league.hiring.JooqCandidatePoolRepository;
import app.zoneblitz.league.hiring.JooqCandidateRepository;
import app.zoneblitz.league.hiring.ScoutBranch;
import app.zoneblitz.league.phase.LeaguePhase;
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
import org.springframework.dao.DataIntegrityViolationException;

@JooqTest
@Import(PostgresTestcontainer.class)
class JooqTeamStaffRepositoryTests {

  @Autowired DSLContext dsl;

  private TeamStaffRepository staff;
  private CandidateRepository candidates;
  private long teamId;
  private long poolId;

  @BeforeEach
  void setUp() {
    staff = new JooqTeamStaffRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    var leagues = new JooqLeagueRepository(dsl);
    var pools = new JooqCandidatePoolRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    var leagueId =
        leagues
            .insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults())
            .id();
    var franchiseId = franchises.listAll().getFirst().id();
    teamRepo.insertAll(leagueId, List.of(new TeamDraft(franchiseId, Optional.of("sub-1"))), 0L);
    teamId =
        dsl.select(TEAMS.ID).from(TEAMS).where(TEAMS.LEAGUE_ID.eq(leagueId)).fetchOne(TEAMS.ID);
    poolId =
        pools.insert(leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH).id();
  }

  @Test
  void insert_coachHire_persistsWithoutScoutBranch() {
    var candidate = candidates.insert(CandidateTestData.newHeadCoach(poolId));
    var hire =
        staff.insert(
            new NewTeamStaffMember(
                teamId,
                candidate.id(),
                StaffRole.HEAD_COACH,
                Optional.empty(),
                LeaguePhase.HIRING_HEAD_COACH,
                2));

    assertThat(hire.id()).isPositive();
    assertThat(hire.role()).isEqualTo(StaffRole.HEAD_COACH);
    assertThat(hire.scoutBranch()).isEmpty();
    assertThat(hire.hiredAtPhase()).isEqualTo(LeaguePhase.HIRING_HEAD_COACH);
    assertThat(hire.hiredAtDay()).isEqualTo(2);
    assertThat(hire.hiredAt()).isNotNull();
  }

  @Test
  void insert_scoutHire_recordsBranch() {
    var candidate = candidates.insert(CandidateTestData.newScout(poolId, ScoutBranch.COLLEGE));
    var hire =
        staff.insert(
            new NewTeamStaffMember(
                teamId,
                candidate.id(),
                StaffRole.COLLEGE_SCOUT,
                Optional.of(ScoutBranch.COLLEGE),
                LeaguePhase.ASSEMBLING_STAFF,
                1));

    assertThat(hire.scoutBranch()).hasValue(ScoutBranch.COLLEGE);
  }

  @Test
  void insert_duplicateUniqueRoleForTeam_throws() {
    var first = candidates.insert(CandidateTestData.newHeadCoach(poolId));
    var second = candidates.insert(CandidateTestData.newHeadCoach(poolId));
    staff.insert(
        new NewTeamStaffMember(
            teamId,
            first.id(),
            StaffRole.HEAD_COACH,
            Optional.empty(),
            LeaguePhase.HIRING_HEAD_COACH,
            1));

    assertThatThrownBy(
            () ->
                staff.insert(
                    new NewTeamStaffMember(
                        teamId,
                        second.id(),
                        StaffRole.HEAD_COACH,
                        Optional.empty(),
                        LeaguePhase.HIRING_HEAD_COACH,
                        1)))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void insert_multipleScoutsForSameTeam_allowed() {
    var a = candidates.insert(CandidateTestData.newScout(poolId, ScoutBranch.COLLEGE));
    var b = candidates.insert(CandidateTestData.newScout(poolId, ScoutBranch.COLLEGE));
    staff.insert(
        new NewTeamStaffMember(
            teamId,
            a.id(),
            StaffRole.COLLEGE_SCOUT,
            Optional.of(ScoutBranch.COLLEGE),
            LeaguePhase.ASSEMBLING_STAFF,
            1));
    staff.insert(
        new NewTeamStaffMember(
            teamId,
            b.id(),
            StaffRole.COLLEGE_SCOUT,
            Optional.of(ScoutBranch.COLLEGE),
            LeaguePhase.ASSEMBLING_STAFF,
            1));

    assertThat(staff.findAllForTeam(teamId)).hasSize(2);
  }

  @Test
  void findById_whenMissing_returnsEmpty() {
    assertThat(staff.findById(999_999L)).isEmpty();
  }
}
