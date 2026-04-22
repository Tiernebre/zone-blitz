package app.zoneblitz.league.cap;

import static app.zoneblitz.jooq.Tables.CANDIDATES;
import static app.zoneblitz.jooq.Tables.CANDIDATE_OFFERS;
import static app.zoneblitz.jooq.Tables.CANDIDATE_POOLS;
import static app.zoneblitz.jooq.Tables.STAFF_CONTRACTS;
import static app.zoneblitz.jooq.Tables.TEAMS;
import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.LeagueSettings;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
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
import org.jooq.JSONB;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

@JooqTest
@Import(PostgresTestcontainer.class)
class ViewStaffCapUseCaseTests {

  private static final long BUDGET_CENTS = 25_000_000_00L;
  private static final String OWNER = "sub-1";

  @Autowired DSLContext dsl;

  private ViewStaffCap useCase;
  private JooqTeamStaffRepository teamStaff;
  private long leagueId;
  private long teamId;
  private long poolId;

  @BeforeEach
  void setUp() {
    var leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teams = new JooqTeamRepository(dsl);
    teamStaff = new JooqTeamStaffRepository(dsl);
    useCase = new ViewStaffCapUseCase(leagues, new JooqStaffCapBreakdownRepository(dsl));

    var league =
        leagues.insert(OWNER, "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());
    leagueId = league.id();
    var listed = franchises.listAll();
    teams.insertAll(leagueId, List.of(new TeamDraft(listed.get(0).id(), Optional.of(OWNER))), 0L);
    teamId =
        dsl.select(TEAMS.ID).from(TEAMS).where(TEAMS.LEAGUE_ID.eq(leagueId)).fetchOne(TEAMS.ID);
    dsl.update(TEAMS)
        .set(TEAMS.STAFF_BUDGET_CENTS, BUDGET_CENTS)
        .where(TEAMS.ID.eq(teamId))
        .execute();
    poolId =
        dsl.insertInto(CANDIDATE_POOLS)
            .set(CANDIDATE_POOLS.LEAGUE_ID, leagueId)
            .set(CANDIDATE_POOLS.PHASE, LeaguePhase.HIRING_HEAD_COACH.name())
            .set(CANDIDATE_POOLS.CANDIDATE_TYPE, "HEAD_COACH")
            .returning(CANDIDATE_POOLS.ID)
            .fetchOne()
            .getId();
  }

  @Test
  void view_unknownOwner_returnsEmpty() {
    assertThat(useCase.view(leagueId, "other-owner")).isEmpty();
  }

  @Test
  void view_emptyState_returnsBudgetAndNoLines() {
    var result = useCase.view(leagueId, OWNER).orElseThrow();

    assertThat(result.budgetCents()).isEqualTo(BUDGET_CENTS);
    assertThat(result.committedCents()).isZero();
    assertThat(result.availableCents()).isEqualTo(BUDGET_CENTS);
    assertThat(result.contracts()).isEmpty();
    assertThat(result.offers()).isEmpty();
    assertThat(result.deadCap()).isEmpty();
  }

  @Test
  void view_activeContractOutstandingOfferAndDeadCap_allContributeToBreakdown() {
    var headCoachId = insertCandidate("Chip", "Kelly", "HEAD_COACH");
    var staffId =
        teamStaff
            .insert(
                new NewTeamStaffMember(
                    teamId,
                    headCoachId,
                    StaffRole.HEAD_COACH,
                    Optional.empty(),
                    LeaguePhase.HIRING_HEAD_COACH,
                    1))
            .id();
    insertContract(headCoachId, staffId, 8_500_000_00L, 8_500_000_00L, 5, 1, 5, null);

    var firedId = insertCandidate("Dan", "Campbell", "HEAD_COACH");
    var firedStaffId =
        teamStaff
            .insert(
                new NewTeamStaffMember(
                    teamId,
                    firedId,
                    StaffRole.OFFENSIVE_COORDINATOR,
                    Optional.empty(),
                    LeaguePhase.HIRING_HEAD_COACH,
                    1))
            .id();
    // Guarantee 10M across 5 years → 2M/year dead cap after termination
    insertContract(firedId, firedStaffId, 4_000_000_00L, 10_000_000_00L, 5, 1, 5, 1);

    var pendingCandidateId = insertCandidate("Nick", "Saban", "OFFENSIVE_COORDINATOR");
    insertOfferActive(pendingCandidateId, 3_000_000_00L, 3);

    // Dead cap only applies in seasons *after* termination. Bump league to season 2 so Dan
    // Campbell's terminated contract (terminated_at_season=1) shows up in dead cap.
    dsl.update(app.zoneblitz.jooq.Tables.LEAGUES)
        .set(app.zoneblitz.jooq.Tables.LEAGUES.SEASON, 2)
        .where(app.zoneblitz.jooq.Tables.LEAGUES.ID.eq(leagueId))
        .execute();

    var view = useCase.view(leagueId, OWNER).orElseThrow();

    assertThat(view.contracts()).hasSize(1);
    assertThat(view.contracts().get(0).staffName()).isEqualTo("Chip Kelly");
    assertThat(view.contracts().get(0).roleDisplay()).isEqualTo("Head Coach");
    assertThat(view.contracts().get(0).apyCents()).isEqualTo(8_500_000_00L);

    assertThat(view.offers()).hasSize(1);
    assertThat(view.offers().get(0).candidateName()).isEqualTo("Nick Saban");
    assertThat(view.offers().get(0).kindDisplay()).isEqualTo("Offensive Coordinator");
    assertThat(view.offers().get(0).apyCents()).isEqualTo(3_000_000_00L);
    assertThat(view.offers().get(0).contractYears()).isEqualTo(3);

    assertThat(view.deadCap()).hasSize(1);
    assertThat(view.deadCap().get(0).staffName()).isEqualTo("Dan Campbell");
    assertThat(view.deadCap().get(0).annualCents()).isEqualTo(2_000_000_00L);

    assertThat(view.committedCents()).isEqualTo(8_500_000_00L + 3_000_000_00L + 2_000_000_00L);
    assertThat(view.availableCents())
        .isEqualTo(BUDGET_CENTS - (8_500_000_00L + 3_000_000_00L + 2_000_000_00L));
  }

  private long insertCandidate(String first, String last, String kind) {
    return dsl.insertInto(CANDIDATES)
        .set(CANDIDATES.POOL_ID, poolId)
        .set(CANDIDATES.KIND, kind)
        .set(CANDIDATES.SPECIALTY_POSITION, "QB")
        .set(CANDIDATES.ARCHETYPE, "CEO")
        .set(CANDIDATES.AGE, 45)
        .set(CANDIDATES.TOTAL_EXPERIENCE_YEARS, 10)
        .set(CANDIDATES.FIRST_NAME, first)
        .set(CANDIDATES.LAST_NAME, last)
        .returning(CANDIDATES.ID)
        .fetchOne()
        .getId();
  }

  private void insertContract(
      long candidateId,
      long teamStaffId,
      long apyCents,
      long guaranteeCents,
      int years,
      int startSeason,
      int endSeason,
      Integer terminatedAtSeason) {
    var step =
        dsl.insertInto(STAFF_CONTRACTS)
            .set(STAFF_CONTRACTS.TEAM_ID, teamId)
            .set(STAFF_CONTRACTS.CANDIDATE_ID, candidateId)
            .set(STAFF_CONTRACTS.TEAM_STAFF_ID, teamStaffId)
            .set(STAFF_CONTRACTS.APY_CENTS, apyCents)
            .set(STAFF_CONTRACTS.GUARANTEE_CENTS, guaranteeCents)
            .set(STAFF_CONTRACTS.CONTRACT_YEARS, years)
            .set(STAFF_CONTRACTS.START_SEASON, startSeason)
            .set(STAFF_CONTRACTS.END_SEASON, endSeason);
    if (terminatedAtSeason != null) {
      step = step.set(STAFF_CONTRACTS.TERMINATED_AT_SEASON, terminatedAtSeason);
    }
    step.execute();
  }

  private void insertOfferActive(long candidateId, long compensationCents, int years) {
    var dollars = compensationCents / 100.0;
    var terms =
        """
        {"compensation":%s,"contract_length_years":%d,"guaranteed_money_pct":0.85,"role_scope":"HIGH","staff_continuity":"BRING_OWN"}
        """
            .formatted(String.format("%.2f", dollars), years)
            .trim();
    dsl.insertInto(CANDIDATE_OFFERS)
        .set(CANDIDATE_OFFERS.CANDIDATE_ID, candidateId)
        .set(CANDIDATE_OFFERS.TEAM_ID, teamId)
        .set(CANDIDATE_OFFERS.TERMS, JSONB.valueOf(terms))
        .set(CANDIDATE_OFFERS.SUBMITTED_AT_DAY, 1)
        .set(CANDIDATE_OFFERS.STATUS, "ACTIVE")
        .execute();
  }
}
