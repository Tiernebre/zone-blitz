package app.zoneblitz.league.hiring.offer;

import static org.assertj.core.api.Assertions.assertThat;

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
import app.zoneblitz.league.hiring.OfferStance;
import app.zoneblitz.league.hiring.OfferStatus;
import app.zoneblitz.league.hiring.OfferTerms;
import app.zoneblitz.league.hiring.candidates.JooqCandidatePoolRepository;
import app.zoneblitz.league.hiring.candidates.JooqCandidatePreferencesRepository;
import app.zoneblitz.league.hiring.candidates.JooqCandidateRepository;
import app.zoneblitz.league.hiring.generation.HeadCoachGenerator;
import app.zoneblitz.league.hiring.hire.CpuHiringStrategy;
import app.zoneblitz.league.hiring.hire.JooqStaffBudgetRepository;
import app.zoneblitz.league.hiring.hire.JooqStaffContractRepository;
import app.zoneblitz.league.hiring.interview.JooqTeamInterviewRepository;
import app.zoneblitz.league.phase.HiringHeadCoachTransitionHandler;
import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.staff.JooqTeamStaffRepository;
import app.zoneblitz.league.staff.RoleScope;
import app.zoneblitz.league.staff.StaffContinuity;
import app.zoneblitz.league.staff.StaffRole;
import app.zoneblitz.league.staff.TeamStaffMember;
import app.zoneblitz.league.team.CityTeamProfiles;
import app.zoneblitz.league.team.JooqTeamHiringStateRepository;
import app.zoneblitz.league.team.JooqTeamLookup;
import app.zoneblitz.league.team.JooqTeamRepository;
import app.zoneblitz.league.team.TeamHiringState;
import app.zoneblitz.league.team.TeamLookup;
import app.zoneblitz.league.team.TeamProfiles;
import app.zoneblitz.support.PostgresTestcontainer;
import java.math.BigDecimal;
import java.util.List;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

@JooqTest
@Import(PostgresTestcontainer.class)
class PreferenceScoringOfferResolverTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private JooqCandidatePoolRepository pools;
  private JooqCandidateRepository candidates;
  private JooqCandidatePreferencesRepository preferences;
  private JooqCandidateOfferRepository offers;
  private JooqTeamHiringStateRepository hiringStates;
  private JooqTeamStaffRepository staff;
  private JooqStaffBudgetRepository budgets;
  private JooqStaffContractRepository staffContracts;
  private TeamProfiles profiles;
  private CandidateRandomSources rngs;
  private OfferResolver resolver;
  private CpuHiringStrategy hcCpuStrategy;
  private JooqTeamInterviewRepository interviews;
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
    budgets = new JooqStaffBudgetRepository(dsl);
    staffContracts = new JooqStaffContractRepository(dsl);
    interviews = new JooqTeamInterviewRepository(dsl);
    profiles = new CityTeamProfiles(dsl, franchises);
    rngs = (leagueId, phase) -> new FakeRandomSource(leagueId + phase.ordinal());
    hcCpuStrategy =
        new CpuHiringStrategy(
            LeaguePhase.HIRING_HEAD_COACH,
            CandidatePoolType.HEAD_COACH,
            pools,
            candidates,
            preferences,
            offers,
            hiringStates,
            interviews,
            profiles);
    resolver =
        new PreferenceScoringOfferResolver(
            offers,
            candidates,
            pools,
            preferences,
            profiles,
            hiringStates,
            staff,
            teams,
            rngs,
            budgets,
            staffContracts,
            leagues,
            List.of(hcCpuStrategy));
    createLeague = new CreateLeagueUseCase(leagues, franchises, teamRepo);
    entryHandler =
        new HiringHeadCoachTransitionHandler(
            leagues,
            teams,
            pools,
            candidates,
            preferences,
            hiringStates,
            new HeadCoachGenerator(app.zoneblitz.names.CuratedNameGenerator.maleDefaults()),
            rngs);
  }

  @Test
  void resolve_cpuOfferMeetingThreshold_setsAgreedAndAutoHires() {
    var ctx = seedLeague();
    dominateComp(ctx.candidateId);
    var offer =
        offers.insertActive(ctx.candidateId, ctx.cpuTeamId, OfferTermsJson.toJson(goodTerms()), 1);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 2);

    assertThat(offers.findById(offer.id()).orElseThrow().status()).isEqualTo(OfferStatus.ACCEPTED);
    assertThat(candidates.findById(ctx.candidateId).orElseThrow().hiredByTeamId())
        .contains(ctx.cpuTeamId);
    assertThat(hiringStates.find(ctx.cpuTeamId, LeaguePhase.HIRING_HEAD_COACH).orElseThrow().step())
        .isEqualTo(HiringStep.HIRED);
    assertThat(staff.findAllForTeam(ctx.cpuTeamId))
        .extracting(TeamStaffMember::role)
        .containsExactly(StaffRole.HEAD_COACH);
  }

  @Test
  void resolve_userOfferMeetingThreshold_setsAgreedButDoesNotHire() {
    var ctx = seedLeague();
    dominateComp(ctx.candidateId);
    var offer =
        offers.insertActive(ctx.candidateId, ctx.userTeamId, OfferTermsJson.toJson(goodTerms()), 1);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 2);

    var reloaded = offers.findById(offer.id()).orElseThrow();
    assertThat(reloaded.status()).isEqualTo(OfferStatus.ACTIVE);
    assertThat(reloaded.stance()).contains(OfferStance.AGREED);
    assertThat(candidates.findById(ctx.candidateId).orElseThrow().hiredByTeamId()).isEmpty();
  }

  @Test
  void resolve_userAndCpuBothAgreed_cpuDefersToUserPriority() {
    var ctx = seedLeague();
    dominateComp(ctx.candidateId);
    var userOffer =
        offers.insertActive(ctx.candidateId, ctx.userTeamId, OfferTermsJson.toJson(goodTerms()), 1);
    var cpuOffer =
        offers.insertActive(ctx.candidateId, ctx.cpuTeamId, OfferTermsJson.toJson(goodTerms()), 1);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 2);

    assertThat(offers.findById(userOffer.id()).orElseThrow().status())
        .isEqualTo(OfferStatus.ACTIVE);
    assertThat(offers.findById(cpuOffer.id()).orElseThrow().status()).isEqualTo(OfferStatus.ACTIVE);
    assertThat(candidates.findById(ctx.candidateId).orElseThrow().hiredByTeamId()).isEmpty();
  }

  @Test
  void resolve_lowScore_marksRenegotiate() {
    var ctx = seedLeague();
    dominateComp(ctx.candidateId);
    var offer =
        offers.insertActive(
            ctx.candidateId, ctx.userTeamId, OfferTermsJson.toJson(lowCompOffer()), 1);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 2);

    var reloaded = offers.findById(offer.id()).orElseThrow();
    assertThat(reloaded.status()).isEqualTo(OfferStatus.ACTIVE);
    assertThat(reloaded.stance()).contains(OfferStance.RENEGOTIATE);
  }

  @Test
  void resolve_counterPendingExpired_rejectsOffer() {
    var ctx = seedLeague();
    dominateComp(ctx.candidateId);
    var leadingOffer =
        offers.insertActive(ctx.candidateId, ctx.cpuTeamId, OfferTermsJson.toJson(goodTerms()), 1);
    var preferredOffer =
        offers.insertActive(ctx.candidateId, ctx.userTeamId, OfferTermsJson.toJson(goodTerms()), 1);
    offers.flipToCounterPending(preferredOffer.id(), leadingOffer.id(), 1);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 5);

    assertThat(offers.findById(preferredOffer.id()).orElseThrow().status())
        .isEqualTo(OfferStatus.REJECTED);
  }

  @Test
  void resolve_counterPendingNotYetExpired_staysPending() {
    var ctx = seedLeague();
    dominateComp(ctx.candidateId);
    var leadingOffer =
        offers.insertActive(ctx.candidateId, ctx.cpuTeamId, OfferTermsJson.toJson(goodTerms()), 1);
    var preferredOffer =
        offers.insertActive(ctx.candidateId, ctx.userTeamId, OfferTermsJson.toJson(goodTerms()), 1);
    offers.flipToCounterPending(preferredOffer.id(), leadingOffer.id(), 10);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 5);

    assertThat(offers.findById(preferredOffer.id()).orElseThrow().status())
        .isEqualTo(OfferStatus.COUNTER_PENDING);
  }

  @Test
  void resolve_cpuMatchesCounter_ifBudgetAllowsAndStanceAggressive() {
    var ctx = seedLeague();
    preferCpuTeamFit(ctx.candidateId, ctx.cpuTeamId);
    var userLeadingOffer =
        offers.insertActive(ctx.candidateId, ctx.userTeamId, OfferTermsJson.toJson(goodTerms()), 1);
    var cpuPreferredOffer =
        offers.insertActive(ctx.candidateId, ctx.cpuTeamId, OfferTermsJson.toJson(goodTerms()), 1);
    offers.flipToCounterPending(cpuPreferredOffer.id(), userLeadingOffer.id(), 10);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 2);

    var reloaded = offers.findById(cpuPreferredOffer.id()).orElseThrow();
    assertThat(reloaded.status()).isEqualTo(OfferStatus.ACTIVE);
    assertThat(reloaded.stance()).contains(OfferStance.PENDING);
  }

  @Test
  void resolve_cpuWalksCounter_ifBudgetInsufficient() {
    var ctx = seedLeague();
    dominateComp(ctx.candidateId);
    dsl.update(app.zoneblitz.jooq.Tables.TEAMS)
        .set(app.zoneblitz.jooq.Tables.TEAMS.STAFF_BUDGET_CENTS, 100L)
        .where(app.zoneblitz.jooq.Tables.TEAMS.ID.eq(ctx.cpuTeamId))
        .execute();
    var userLeadingOffer =
        offers.insertActive(ctx.candidateId, ctx.userTeamId, OfferTermsJson.toJson(goodTerms()), 1);
    var cpuPreferredOffer =
        offers.insertActive(
            ctx.candidateId, ctx.cpuTeamId, OfferTermsJson.toJson(lowCompOffer()), 1);
    offers.flipToCounterPending(cpuPreferredOffer.id(), userLeadingOffer.id(), 10);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 2);

    assertThat(offers.findById(cpuPreferredOffer.id()).orElseThrow().status())
        .isEqualTo(OfferStatus.REJECTED);
  }

  @Test
  void resolve_preferredTeamCloseToLeader_flipsToCounterPending() {
    var ctx = seedLeague();
    var distinctCpuTeam = findDistinctCpuTeam(ctx);
    preferCpuTeamFit(ctx.candidateId, distinctCpuTeam);
    hiringStates.upsert(
        new TeamHiringState(
            0L, distinctCpuTeam, LeaguePhase.HIRING_HEAD_COACH, HiringStep.SEARCHING, List.of()));
    var userLeading =
        offers.insertActive(
            ctx.candidateId,
            ctx.userTeamId,
            OfferTermsJson.toJson(termsWithComp("10500000.00")),
            1);
    var cpuPreferred =
        offers.insertActive(
            ctx.candidateId,
            distinctCpuTeam,
            OfferTermsJson.toJson(termsWithComp("10000000.00")),
            1);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 2);

    var reloaded = offers.findById(cpuPreferred.id()).orElseThrow();
    assertThat(reloaded.status()).isEqualTo(OfferStatus.COUNTER_PENDING);
    assertThat(reloaded.competingOfferId()).contains(userLeading.id());
    assertThat(reloaded.counterDeadlineDay()).contains(4);
  }

  @Test
  void resolve_preferredTeamBeyondMargin_doesNotFlip() {
    var ctx = seedLeague();
    var distinctCpuTeam = findDistinctCpuTeam(ctx);
    preferCpuTeamFit(ctx.candidateId, distinctCpuTeam);
    offers.insertActive(
        ctx.candidateId, ctx.userTeamId, OfferTermsJson.toJson(termsWithComp("20000000.00")), 1);
    var cpuPreferred =
        offers.insertActive(
            ctx.candidateId,
            distinctCpuTeam,
            OfferTermsJson.toJson(termsWithComp("5000000.00")),
            1);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 2);

    assertThat(offers.findById(cpuPreferred.id()).orElseThrow().status())
        .isEqualTo(OfferStatus.ACTIVE);
  }

  @Test
  void resolve_idempotent_noChangesOnSecondRunSameDay() {
    // Preferred = user team so cpuRespondToCounters does not run against it and leaves the
    // counter untouched across repeat ticks.
    var ctx = seedLeague();
    var distinctCpuTeam = findDistinctCpuTeam(ctx);
    preferUserTeamFit(ctx.candidateId, ctx.userTeamId);
    offers.insertActive(
        ctx.candidateId, distinctCpuTeam, OfferTermsJson.toJson(termsWithComp("10500000.00")), 1);
    var userPreferred =
        offers.insertActive(
            ctx.candidateId,
            ctx.userTeamId,
            OfferTermsJson.toJson(termsWithComp("10000000.00")),
            1);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 2);
    var afterFirst = offers.findById(userPreferred.id()).orElseThrow();
    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 2);
    var afterSecond = offers.findById(userPreferred.id()).orElseThrow();

    assertThat(afterFirst.status()).isEqualTo(OfferStatus.COUNTER_PENDING);
    assertThat(afterSecond.status()).isEqualTo(afterFirst.status());
    assertThat(afterSecond.counterDeadlineDay()).isEqualTo(afterFirst.counterDeadlineDay());
    assertThat(afterSecond.competingOfferId()).isEqualTo(afterFirst.competingOfferId());
  }

  private void preferUserTeamFit(long candidateId, long userTeamId) {
    var profile = profiles.forTeam(userTeamId).orElseThrow();
    dsl.update(app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES)
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.COMPENSATION_WEIGHT,
            new BigDecimal("0.900"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.CONTRACT_LENGTH_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.GUARANTEED_MONEY_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.MARKET_SIZE_WEIGHT,
            new BigDecimal("0.033"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.GEOGRAPHY_WEIGHT,
            new BigDecimal("0.033"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.CLIMATE_WEIGHT, new BigDecimal("0.034"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.FRANCHISE_PRESTIGE_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.COMPETITIVE_WINDOW_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.ROLE_SCOPE_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.STAFF_CONTINUITY_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.SCHEME_ALIGNMENT_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.OWNER_STABILITY_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.FACILITY_QUALITY_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.COMPENSATION_TARGET,
            new BigDecimal("15000000.00"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.MARKET_SIZE_TARGET,
            profile.marketSize().name())
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.GEOGRAPHY_TARGET,
            profile.geography().name())
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.CLIMATE_TARGET,
            profile.climate().name())
        .where(app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.CANDIDATE_ID.eq(candidateId))
        .execute();
  }

  @Test
  void resolve_walkedCounter_leadingOfferWins() {
    var ctx = seedLeague();
    dominateComp(ctx.candidateId);
    var userLeading =
        offers.insertActive(ctx.candidateId, ctx.userTeamId, OfferTermsJson.toJson(goodTerms()), 1);
    var cpuPreferred =
        offers.insertActive(ctx.candidateId, ctx.cpuTeamId, OfferTermsJson.toJson(goodTerms()), 1);
    offers.flipToCounterPending(cpuPreferred.id(), userLeading.id(), 1);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 5);

    assertThat(offers.findById(cpuPreferred.id()).orElseThrow().status())
        .isEqualTo(OfferStatus.REJECTED);
    assertThat(offers.findById(userLeading.id()).orElseThrow().status())
        .isEqualTo(OfferStatus.ACTIVE);
  }

  @Test
  void resolve_matchedCounter_reResolvesAndPicksPreferredTeam() {
    var ctx = seedLeague();
    var cpuTeam2 = teams.cpuTeamIdsForLeague(ctx.leagueId).get(1);
    preferCpuTeamFit(ctx.candidateId, cpuTeam2);
    hiringStates.upsert(
        new TeamHiringState(
            0L, cpuTeam2, LeaguePhase.HIRING_HEAD_COACH, HiringStep.SEARCHING, List.of()));
    var leader =
        offers.insertActive(ctx.candidateId, ctx.cpuTeamId, OfferTermsJson.toJson(goodTerms()), 1);
    var preferred =
        offers.insertActive(ctx.candidateId, cpuTeam2, OfferTermsJson.toJson(goodTerms()), 1);
    offers.flipToCounterPending(preferred.id(), leader.id(), 10);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 2);
    assertThat(offers.findById(preferred.id()).orElseThrow().status())
        .isEqualTo(OfferStatus.ACTIVE);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 4);
    assertThat(candidates.findById(ctx.candidateId).orElseThrow().hiredByTeamId()).isPresent();
  }

  private long findDistinctCpuTeam(Ctx ctx) {
    var userProfile = profiles.forTeam(ctx.userTeamId).orElseThrow();
    return teams.cpuTeamIdsForLeague(ctx.leagueId).stream()
        .filter(
            t -> {
              var p = profiles.forTeam(t).orElseThrow();
              return p.geography() != userProfile.geography()
                  || p.climate() != userProfile.climate()
                  || p.marketSize() != userProfile.marketSize();
            })
        .findFirst()
        .orElseThrow();
  }

  private void preferCpuTeamFit(long candidateId, long cpuTeamId) {
    var profile = profiles.forTeam(cpuTeamId).orElseThrow();
    dsl.update(app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES)
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.COMPENSATION_WEIGHT,
            new BigDecimal("0.900"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.CONTRACT_LENGTH_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.GUARANTEED_MONEY_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.MARKET_SIZE_WEIGHT,
            new BigDecimal("0.033"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.GEOGRAPHY_WEIGHT,
            new BigDecimal("0.033"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.CLIMATE_WEIGHT, new BigDecimal("0.034"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.FRANCHISE_PRESTIGE_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.COMPETITIVE_WINDOW_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.ROLE_SCOPE_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.STAFF_CONTINUITY_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.SCHEME_ALIGNMENT_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.OWNER_STABILITY_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.FACILITY_QUALITY_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.COMPENSATION_TARGET,
            new BigDecimal("15000000.00"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.MARKET_SIZE_TARGET,
            profile.marketSize().name())
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.GEOGRAPHY_TARGET,
            profile.geography().name())
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.CLIMATE_TARGET,
            profile.climate().name())
        .where(app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.CANDIDATE_ID.eq(candidateId))
        .execute();
  }

  private static OfferTerms termsWithComp(String comp) {
    return new OfferTerms(
        new BigDecimal(comp), 6, new BigDecimal("0.95"), RoleScope.HIGH, StaffContinuity.BRING_OWN);
  }

  @Test
  void resolve_revisionCapExceededBelowThreshold_rejectsOffer() {
    var ctx = seedLeague();
    dominateComp(ctx.candidateId);
    var offer =
        offers.insertActive(
            ctx.candidateId, ctx.userTeamId, OfferTermsJson.toJson(lowCompOffer()), 1);
    // Simulate three prior revisions that never reached AGREED. Use revise() to bump counter.
    for (int i = 0; i < StanceEvaluator.REVISION_CAP; i++) {
      offers.revise(offer.id(), OfferTermsJson.toJson(lowCompOffer()), 1);
    }

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 2);

    assertThat(offers.findById(offer.id()).orElseThrow().status()).isEqualTo(OfferStatus.REJECTED);
  }

  private void dominateComp(long candidateId) {
    dsl.update(app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES)
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.COMPENSATION_WEIGHT,
            new BigDecimal("1.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.CONTRACT_LENGTH_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.GUARANTEED_MONEY_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.MARKET_SIZE_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.GEOGRAPHY_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.CLIMATE_WEIGHT, new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.FRANCHISE_PRESTIGE_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.COMPETITIVE_WINDOW_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.ROLE_SCOPE_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.STAFF_CONTINUITY_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.SCHEME_ALIGNMENT_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.OWNER_STABILITY_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.FACILITY_QUALITY_WEIGHT,
            new BigDecimal("0.000"))
        .set(
            app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.COMPENSATION_TARGET,
            new BigDecimal("10000000.00"))
        .where(app.zoneblitz.jooq.Tables.CANDIDATE_PREFERENCES.CANDIDATE_ID.eq(candidateId))
        .execute();
  }

  private Ctx seedLeague() {
    var league = createLeagueFor("sub-" + System.nanoTime());
    leagues.updatePhaseAndResetDay(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    entryHandler.onEntry(league.id());
    var pool =
        pools
            .findByLeaguePhaseAndType(
                league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH)
            .orElseThrow();
    var firstCandidate = candidates.findAllByPoolId(pool.id()).getFirst();
    var userTeamId = teams.userTeamIdForLeague(league.id()).orElseThrow();
    var cpuTeamId = teams.cpuTeamIdsForLeague(league.id()).getFirst();
    hiringStates.upsert(
        new TeamHiringState(
            0L, cpuTeamId, LeaguePhase.HIRING_HEAD_COACH, HiringStep.SEARCHING, List.of()));
    return new Ctx(league.id(), firstCandidate.id(), userTeamId, cpuTeamId);
  }

  private League createLeagueFor(String ownerSubject) {
    var franchiseId = new JooqFranchiseRepository(dsl).listAll().getFirst().id();
    var result = createLeague.create(ownerSubject, "Dynasty-" + ownerSubject, franchiseId);
    return ((CreateLeagueResult.Created) result).league();
  }

  private static OfferTerms goodTerms() {
    return new OfferTerms(
        new BigDecimal("20000000.00"),
        6,
        new BigDecimal("0.95"),
        RoleScope.HIGH,
        StaffContinuity.BRING_OWN);
  }

  private static OfferTerms lowCompOffer() {
    return new OfferTerms(
        new BigDecimal("500000.00"),
        1,
        new BigDecimal("0.01"),
        RoleScope.LOW,
        StaffContinuity.KEEP_EXISTING);
  }

  private record Ctx(long leagueId, long candidateId, long userTeamId, long cpuTeamId) {}
}
