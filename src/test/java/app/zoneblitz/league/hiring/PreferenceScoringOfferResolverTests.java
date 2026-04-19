package app.zoneblitz.league.hiring;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.CreateLeague;
import app.zoneblitz.league.CreateLeagueResult;
import app.zoneblitz.league.CreateLeagueUseCase;
import app.zoneblitz.league.FakeRandomSource;
import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.League;
import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
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
  private TeamProfiles profiles;
  private CandidateRandomSources rngs;
  private OfferResolver resolver;
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
    profiles = new CityTeamProfiles(dsl, franchises);
    rngs = (leagueId, phase) -> new FakeRandomSource(leagueId + phase.ordinal());
    resolver =
        new PreferenceScoringOfferResolver(
            offers, candidates, pools, preferences, profiles, hiringStates, staff, teams, rngs);
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
