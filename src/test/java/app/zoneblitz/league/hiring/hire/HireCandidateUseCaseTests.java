package app.zoneblitz.league.hiring.hire;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.AdvanceDay;
import app.zoneblitz.league.AdvanceDayResult;
import app.zoneblitz.league.CreateLeague;
import app.zoneblitz.league.CreateLeagueResult;
import app.zoneblitz.league.CreateLeagueUseCase;
import app.zoneblitz.league.FakeRandomSource;
import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.League;
import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.CandidateRandomSources;
import app.zoneblitz.league.hiring.HireCandidate;
import app.zoneblitz.league.hiring.HireCandidateResult;
import app.zoneblitz.league.hiring.OfferStance;
import app.zoneblitz.league.hiring.OfferTerms;
import app.zoneblitz.league.hiring.candidates.JooqCandidatePoolRepository;
import app.zoneblitz.league.hiring.candidates.JooqCandidatePreferencesRepository;
import app.zoneblitz.league.hiring.candidates.JooqCandidateRepository;
import app.zoneblitz.league.hiring.generation.HeadCoachGenerator;
import app.zoneblitz.league.hiring.offer.JooqCandidateOfferRepository;
import app.zoneblitz.league.hiring.offer.OfferTermsJson;
import app.zoneblitz.league.phase.HiringHeadCoachTransitionHandler;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.staff.JooqTeamStaffRepository;
import app.zoneblitz.league.staff.RoleScope;
import app.zoneblitz.league.staff.StaffContinuity;
import app.zoneblitz.league.staff.StaffRole;
import app.zoneblitz.league.team.JooqTeamHiringStateRepository;
import app.zoneblitz.league.team.JooqTeamLookup;
import app.zoneblitz.league.team.JooqTeamRepository;
import app.zoneblitz.league.team.TeamLookup;
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
class HireCandidateUseCaseTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private JooqCandidatePoolRepository pools;
  private JooqCandidateRepository candidates;
  private JooqCandidatePreferencesRepository preferences;
  private JooqCandidateOfferRepository offers;
  private JooqTeamHiringStateRepository hiringStates;
  private JooqTeamStaffRepository staff;
  private JooqStaffContractRepository staffContracts;
  private HireCandidate useCase;
  private CreateLeague createLeague;
  private HiringHeadCoachTransitionHandler entryHandler;
  private TeamLookup teams;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    teams = new JooqTeamLookup(dsl);
    pools = new JooqCandidatePoolRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    preferences = new JooqCandidatePreferencesRepository(dsl);
    offers = new JooqCandidateOfferRepository(dsl);
    hiringStates = new JooqTeamHiringStateRepository(dsl);
    staff = new JooqTeamStaffRepository(dsl);
    staffContracts = new JooqStaffContractRepository(dsl);
    CandidateRandomSources rngs =
        (leagueId, phase) -> new FakeRandomSource(leagueId + phase.ordinal());
    AdvanceDay noopAdvance =
        new AdvanceDay() {
          @Override
          public AdvanceDayResult advance(long id, String sub) {
            return new AdvanceDayResult.Ticked(
                id,
                LeaguePhase.ASSEMBLING_STAFF,
                1,
                java.util.Optional.of(LeaguePhase.ASSEMBLING_STAFF));
          }

          @Override
          public AdvanceDayResult tickKeepingPhase(long id, String sub) {
            return new AdvanceDayResult.Ticked(
                id, LeaguePhase.HIRING_HEAD_COACH, 2, java.util.Optional.empty());
          }
        };
    app.zoneblitz.league.phase.HiringPhaseAutofill noopAutofill = (lid, p, d) -> {};
    useCase =
        new HireCandidateUseCase(
            leagues,
            pools,
            candidates,
            offers,
            hiringStates,
            staff,
            staffContracts,
            noopAdvance,
            teams,
            noopAutofill);
    createLeague = new CreateLeagueUseCase(leagues, franchises, teamRepo);
    var generatePool =
        new app.zoneblitz.league.hiring.candidates.GenerateCandidatePoolUseCase(
            pools, candidates, preferences, rngs);
    entryHandler =
        new HiringHeadCoachTransitionHandler(
            teams,
            generatePool,
            hiringStates,
            new HeadCoachGenerator(app.zoneblitz.names.CuratedNameGenerator.maleDefaults()));
  }

  @Test
  void hire_createsStaffContract_withCorrectApyAndYears() {
    var ctx =
        prepareAgreedOffer(
            new OfferTerms(
                new BigDecimal("8500000.00"),
                4,
                new BigDecimal("0.95"),
                RoleScope.HIGH,
                StaffContinuity.BRING_OWN));

    var result = useCase.hire(ctx.leagueId, ctx.candidateId, ctx.ownerSubject);

    assertThat(result).isInstanceOf(HireCandidateResult.Hired.class);
    var contracts = staffContracts.findActiveForTeam(ctx.userTeamId);
    assertThat(contracts).hasSize(1);
    var contract = contracts.getFirst();
    assertThat(contract.apyCents()).isEqualTo(850_000_000L);
    assertThat(contract.contractYears()).isEqualTo(4);
    assertThat(contract.startSeason()).isEqualTo(1);
    assertThat(contract.endSeason()).isEqualTo(4);
    assertThat(staff.findAllForTeam(ctx.userTeamId))
        .singleElement()
        .extracting(m -> m.role())
        .isEqualTo(StaffRole.HEAD_COACH);
  }

  @Test
  void hire_rejectsTeamsOtherOutstandingOffers_soSalaryCapDropsThem() {
    var ownerSubject = "sub-" + System.nanoTime();
    var league = createLeagueFor(ownerSubject);
    leagues.updatePhaseAndResetDay(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    entryHandler.onEntry(league.id());
    var pool =
        pools
            .findByLeaguePhaseAndType(
                league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH)
            .orElseThrow();
    var poolCandidates = candidates.findAllByPoolId(pool.id());
    var hiredCandidateId = poolCandidates.get(0).id();
    var otherCandidateId = poolCandidates.get(1).id();
    var userTeamId = teams.userTeamIdForLeague(league.id()).orElseThrow();
    var terms =
        new OfferTerms(
            new BigDecimal("8500000.00"),
            4,
            new BigDecimal("0.95"),
            RoleScope.HIGH,
            StaffContinuity.BRING_OWN);
    var hiredOffer =
        offers.insertActive(hiredCandidateId, userTeamId, OfferTermsJson.toJson(terms), 1);
    offers.setStance(hiredOffer.id(), OfferStance.AGREED);
    var otherOffer =
        offers.insertActive(otherCandidateId, userTeamId, OfferTermsJson.toJson(terms), 1);

    useCase.hire(league.id(), hiredCandidateId, ownerSubject);

    assertThat(offers.findOutstandingForTeam(userTeamId)).isEmpty();
    assertThat(offers.findById(otherOffer.id()))
        .get()
        .extracting(o -> o.status())
        .isEqualTo(app.zoneblitz.league.hiring.OfferStatus.REJECTED);
  }

  @Test
  void hire_createsStaffContract_withCorrectGuaranteeCents() {
    // APY 5,000,000.00 * 5 yrs = 25,000,000.00 * 0.80 guarantee = 20,000,000.00 = 2,000,000,000
    // cents.
    var ctx =
        prepareAgreedOffer(
            new OfferTerms(
                new BigDecimal("5000000.00"),
                5,
                new BigDecimal("0.80"),
                RoleScope.HIGH,
                StaffContinuity.BRING_OWN));

    useCase.hire(ctx.leagueId, ctx.candidateId, ctx.ownerSubject);

    var contract = staffContracts.findActiveForTeam(ctx.userTeamId).getFirst();
    assertThat(contract.apyCents()).isEqualTo(500_000_000L);
    assertThat(contract.guaranteeCents()).isEqualTo(2_000_000_000L);
  }

  private Ctx prepareAgreedOffer(OfferTerms terms) {
    var ownerSubject = "sub-" + System.nanoTime();
    var league = createLeagueFor(ownerSubject);
    leagues.updatePhaseAndResetDay(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    entryHandler.onEntry(league.id());
    var pool =
        pools
            .findByLeaguePhaseAndType(
                league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH)
            .orElseThrow();
    var candidateId = candidates.findAllByPoolId(pool.id()).getFirst().id();
    var userTeamId = teams.userTeamIdForLeague(league.id()).orElseThrow();
    var saved = offers.insertActive(candidateId, userTeamId, OfferTermsJson.toJson(terms), 1);
    offers.setStance(saved.id(), OfferStance.AGREED);
    return new Ctx(league.id(), ownerSubject, candidateId, userTeamId);
  }

  private League createLeagueFor(String ownerSubject) {
    var franchiseId = new JooqFranchiseRepository(dsl).listAll().getFirst().id();
    var result = createLeague.create(ownerSubject, "Dynasty-" + ownerSubject, franchiseId);
    return ((CreateLeagueResult.Created) result).league();
  }

  private record Ctx(long leagueId, String ownerSubject, long candidateId, long userTeamId) {}
}
