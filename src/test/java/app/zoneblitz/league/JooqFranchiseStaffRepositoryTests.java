package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.support.PostgresTestcontainer;
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
class JooqFranchiseStaffRepositoryTests {

  @Autowired DSLContext dsl;

  private FranchiseStaffRepository staff;
  private CandidateRepository candidates;
  private long leagueId;
  private long franchiseId;
  private long poolId;

  @BeforeEach
  void setUp() {
    staff = new JooqFranchiseStaffRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    var leagues = new JooqLeagueRepository(dsl);
    var pools = new JooqCandidatePoolRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    leagueId =
        leagues
            .insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults())
            .id();
    franchiseId = franchises.listAll().getFirst().id();
    poolId =
        pools.insert(leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH).id();
  }

  @Test
  void insert_coachHire_persistsWithoutScoutBranch() {
    var candidate = candidates.insert(CandidateTestData.newHeadCoach(poolId));
    var hire =
        staff.insert(
            new NewFranchiseStaffMember(
                leagueId,
                franchiseId,
                candidate.id(),
                StaffRole.HEAD_COACH,
                Optional.empty(),
                LeaguePhase.HIRING_HEAD_COACH,
                2));

    assertThat(hire.id()).isPositive();
    assertThat(hire.role()).isEqualTo(StaffRole.HEAD_COACH);
    assertThat(hire.scoutBranch()).isEmpty();
    assertThat(hire.hiredAtPhase()).isEqualTo(LeaguePhase.HIRING_HEAD_COACH);
    assertThat(hire.hiredAtWeek()).isEqualTo(2);
    assertThat(hire.hiredAt()).isNotNull();
  }

  @Test
  void insert_scoutHire_recordsBranch() {
    var candidate = candidates.insert(CandidateTestData.newScout(poolId, ScoutBranch.COLLEGE));
    var hire =
        staff.insert(
            new NewFranchiseStaffMember(
                leagueId,
                franchiseId,
                candidate.id(),
                StaffRole.COLLEGE_SCOUT,
                Optional.of(ScoutBranch.COLLEGE),
                LeaguePhase.ASSEMBLING_STAFF,
                1));

    assertThat(hire.scoutBranch()).hasValue(ScoutBranch.COLLEGE);
  }

  @Test
  void insert_duplicateUniqueRoleForFranchise_throws() {
    var first = candidates.insert(CandidateTestData.newHeadCoach(poolId));
    var second = candidates.insert(CandidateTestData.newHeadCoach(poolId));
    staff.insert(
        new NewFranchiseStaffMember(
            leagueId,
            franchiseId,
            first.id(),
            StaffRole.HEAD_COACH,
            Optional.empty(),
            LeaguePhase.HIRING_HEAD_COACH,
            1));

    assertThatThrownBy(
            () ->
                staff.insert(
                    new NewFranchiseStaffMember(
                        leagueId,
                        franchiseId,
                        second.id(),
                        StaffRole.HEAD_COACH,
                        Optional.empty(),
                        LeaguePhase.HIRING_HEAD_COACH,
                        1)))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void insert_multipleScoutsForSameFranchise_allowed() {
    var a = candidates.insert(CandidateTestData.newScout(poolId, ScoutBranch.COLLEGE));
    var b = candidates.insert(CandidateTestData.newScout(poolId, ScoutBranch.COLLEGE));
    staff.insert(
        new NewFranchiseStaffMember(
            leagueId,
            franchiseId,
            a.id(),
            StaffRole.COLLEGE_SCOUT,
            Optional.of(ScoutBranch.COLLEGE),
            LeaguePhase.ASSEMBLING_STAFF,
            1));
    staff.insert(
        new NewFranchiseStaffMember(
            leagueId,
            franchiseId,
            b.id(),
            StaffRole.COLLEGE_SCOUT,
            Optional.of(ScoutBranch.COLLEGE),
            LeaguePhase.ASSEMBLING_STAFF,
            1));

    assertThat(staff.findAllForFranchise(leagueId, franchiseId)).hasSize(2);
  }

  @Test
  void findById_whenMissing_returnsEmpty() {
    assertThat(staff.findById(999_999L)).isEmpty();
  }
}
