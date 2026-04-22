package app.zoneblitz.league.hiring.hire;

import static app.zoneblitz.jooq.Tables.TEAMS;
import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.LeagueSettings;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.CandidateTestData;
import app.zoneblitz.league.hiring.OfferStatus;
import app.zoneblitz.league.hiring.OfferTerms;
import app.zoneblitz.league.hiring.candidates.JooqCandidatePoolRepository;
import app.zoneblitz.league.hiring.candidates.JooqCandidateRepository;
import app.zoneblitz.league.hiring.offer.CandidateOfferRepository;
import app.zoneblitz.league.hiring.offer.JooqCandidateOfferRepository;
import app.zoneblitz.league.hiring.offer.OfferTermsJson;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.staff.JooqTeamStaffRepository;
import app.zoneblitz.league.staff.NewTeamStaffMember;
import app.zoneblitz.league.staff.RoleScope;
import app.zoneblitz.league.staff.StaffContinuity;
import app.zoneblitz.league.staff.StaffRole;
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
class JooqStaffBudgetRepositoryTests {

  private static final long BUDGET_CENTS = 25_000_000_00L;

  @Autowired DSLContext dsl;

  private StaffBudgetRepository budgets;
  private StaffContractRepository contracts;
  private CandidateOfferRepository offers;
  private long teamId;
  private long otherTeamId;
  private long candidateId;
  private long otherCandidateId;
  private long teamStaffId;

  @BeforeEach
  void setUp() {
    budgets = new JooqStaffBudgetRepository(dsl);
    contracts = new JooqStaffContractRepository(dsl);
    offers = new JooqCandidateOfferRepository(dsl);

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
    candidateId = candidateRepo.insert(CandidateTestData.newHeadCoach(pool.id())).id();
    otherCandidateId = candidateRepo.insert(CandidateTestData.newHeadCoach(pool.id())).id();
    var listed = franchises.listAll();
    teamRepo.insertAll(
        league.id(),
        List.of(
            new TeamDraft(listed.get(0).id(), Optional.of("sub-1")),
            new TeamDraft(listed.get(1).id(), Optional.empty())),
        0L);
    var teamIds =
        dsl.select(TEAMS.ID)
            .from(TEAMS)
            .where(TEAMS.LEAGUE_ID.eq(league.id()))
            .orderBy(TEAMS.ID.asc())
            .fetch(TEAMS.ID);
    teamId = teamIds.get(0);
    otherTeamId = teamIds.get(1);
    dsl.update(TEAMS)
        .set(TEAMS.STAFF_BUDGET_CENTS, BUDGET_CENTS)
        .where(TEAMS.ID.eq(teamId))
        .execute();
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
  void committed_noContracts_returnsZero() {
    var budget = budgets.committed(teamId, 1);

    assertThat(budget.budgetCents()).isEqualTo(BUDGET_CENTS);
    assertThat(budget.committedCents()).isZero();
    assertThat(budget.availableCents()).isEqualTo(BUDGET_CENTS);
  }

  @Test
  void committed_singleActiveContract_returnsApy() {
    contracts.insert(
        new NewStaffContract(
            teamId, candidateId, teamStaffId, 8_500_000_00L, 8_500_000_00L, 5, 1, 5));

    var budget = budgets.committed(teamId, 1);

    assertThat(budget.committedCents()).isEqualTo(8_500_000_00L);
  }

  @Test
  void committed_multiYearContract_countsInEachSeason() {
    contracts.insert(
        new NewStaffContract(
            teamId, candidateId, teamStaffId, 8_500_000_00L, 42_500_000_00L, 5, 1, 5));

    for (int season = 1; season <= 5; season++) {
      assertThat(budgets.committed(teamId, season).committedCents()).isEqualTo(8_500_000_00L);
    }
  }

  @Test
  void committed_contractEndedBeforeSeason_notCounted() {
    contracts.insert(
        new NewStaffContract(
            teamId, candidateId, teamStaffId, 8_500_000_00L, 8_500_000_00L, 3, 1, 3));

    assertThat(budgets.committed(teamId, 4).committedCents()).isZero();
  }

  @Test
  void committed_terminatedContractWithGuarantee_countsDeadCapInRemainingSeasonsNotPresentSeason() {
    var contract =
        contracts.insert(
            new NewStaffContract(
                teamId, candidateId, teamStaffId, 10_000_000_00L, 50_000_000_00L, 5, 1, 5));
    contracts.terminate(contract.id(), 2);

    // At terminated season (2) the contract APY still counts (terminated_at_season >= season).
    assertThat(budgets.committed(teamId, 2).committedCents()).isEqualTo(10_000_000_00L);
    // Seasons after termination: guarantee / years = 50M/5 = 10M per remaining season.
    var deadCapPerSeason = 50_000_000_00L / 5;
    assertThat(budgets.committed(teamId, 3).committedCents()).isEqualTo(deadCapPerSeason);
    assertThat(budgets.committed(teamId, 4).committedCents()).isEqualTo(deadCapPerSeason);
    assertThat(budgets.committed(teamId, 5).committedCents()).isEqualTo(deadCapPerSeason);
    // After end season, nothing.
    assertThat(budgets.committed(teamId, 6).committedCents()).isZero();
  }

  @Test
  void committed_activePendingOffer_includesOfferApy() {
    offers.insertActive(candidateId, teamId, termsJson(new BigDecimal("7500000.00")), 1);

    var budget = budgets.committed(teamId, 1);

    assertThat(budget.committedCents()).isEqualTo(7_500_000_00L);
  }

  @Test
  void committed_counterPendingOffer_includesOfferApy() {
    // Need two offers on same candidate so we can flip one to COUNTER_PENDING pointing at the
    // other.
    var competingOffer =
        offers.insertActive(candidateId, otherTeamId, termsJson(new BigDecimal("9000000.00")), 1);
    var preferredOffer =
        offers.insertActive(candidateId, teamId, termsJson(new BigDecimal("7500000.00")), 1);
    offers.flipToCounterPending(preferredOffer.id(), competingOffer.id(), 3);

    var budget = budgets.committed(teamId, 1);

    assertThat(budget.committedCents()).isEqualTo(7_500_000_00L);
  }

  @Test
  void committed_rejectedOffer_excluded() {
    var offer =
        offers.insertActive(candidateId, teamId, termsJson(new BigDecimal("7500000.00")), 1);
    offers.resolve(offer.id(), OfferStatus.REJECTED);

    var budget = budgets.committed(teamId, 1);

    assertThat(budget.committedCents()).isZero();
  }

  @Test
  void committed_acceptedOffer_excludedIfContractAlreadyCounted() {
    // Simulate a hire: offer accepted, contract inserted. Only the contract should contribute.
    var offer =
        offers.insertActive(candidateId, teamId, termsJson(new BigDecimal("6500000.00")), 1);
    offers.resolve(offer.id(), OfferStatus.ACCEPTED);
    contracts.insert(
        new NewStaffContract(
            teamId, candidateId, teamStaffId, 6_500_000_00L, 6_500_000_00L, 3, 1, 3));

    var budget = budgets.committed(teamId, 1);

    assertThat(budget.committedCents()).isEqualTo(6_500_000_00L);
  }

  private static String termsJson(BigDecimal compensationDollars) {
    return OfferTermsJson.toJson(
        new OfferTerms(
            compensationDollars,
            5,
            new BigDecimal("0.85"),
            RoleScope.HIGH,
            StaffContinuity.BRING_OWN));
  }
}
