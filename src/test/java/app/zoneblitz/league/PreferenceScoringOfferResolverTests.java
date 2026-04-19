package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;

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
  private JooqFranchiseHiringStateRepository hiringStates;
  private JooqFranchiseStaffRepository staff;
  private FranchiseProfiles profiles;
  private CandidateRandomSources rngs;
  private OfferResolver resolver;
  private CreateLeague createLeague;
  private HiringHeadCoachTransitionHandler entryHandler;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    var teams = new JooqTeamLookup(dsl);
    pools = new JooqCandidatePoolRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    preferences = new JooqCandidatePreferencesRepository(dsl);
    offers = new JooqCandidateOfferRepository(dsl);
    hiringStates = new JooqFranchiseHiringStateRepository(dsl);
    staff = new JooqFranchiseStaffRepository(dsl);
    profiles = new CityFranchiseProfiles(franchises);
    rngs = (leagueId, phase) -> new FakeRandomSource(leagueId + phase.ordinal());
    resolver =
        new PreferenceScoringOfferResolver(
            offers, candidates, pools, preferences, profiles, hiringStates, staff, rngs);
    createLeague = new CreateLeagueUseCase(leagues, franchises, teamRepo);
    entryHandler =
        new HiringHeadCoachTransitionHandler(
            leagues,
            teams,
            pools,
            candidates,
            preferences,
            hiringStates,
            new HeadCoachGenerator(),
            rngs);
  }

  @Test
  void resolve_singleOffer_acceptsAndHires() {
    var ctx = seedLeague();
    var offer =
        offers.insertActive(
            ctx.candidateId, ctx.franchiseId, OfferTermsJson.toJson(goodTerms()), 1);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 1);

    assertThat(offers.findById(offer.id()).orElseThrow().status()).isEqualTo(OfferStatus.ACCEPTED);
    assertThat(candidates.findById(ctx.candidateId).orElseThrow().hiredByFranchiseId())
        .contains(ctx.franchiseId);
    assertThat(
            hiringStates
                .find(ctx.leagueId, ctx.franchiseId, LeaguePhase.HIRING_HEAD_COACH)
                .orElseThrow()
                .step())
        .isEqualTo(HiringStep.HIRED);
    assertThat(staff.findAllForFranchise(ctx.leagueId, ctx.franchiseId))
        .extracting(FranchiseStaffMember::role)
        .containsExactly(StaffRole.HEAD_COACH);
  }

  @Test
  void resolve_multipleOffers_acceptsHighestAndRejectsOthers() {
    var ctx = seedLeague();
    // Lower offer from other franchise
    var loser =
        offers.insertActive(
            ctx.candidateId, ctx.otherFranchiseId, OfferTermsJson.toJson(lowCompOffer()), 1);
    var winner =
        offers.insertActive(
            ctx.candidateId, ctx.franchiseId, OfferTermsJson.toJson(goodTerms()), 1);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 1);

    assertThat(offers.findById(winner.id()).orElseThrow().status()).isEqualTo(OfferStatus.ACCEPTED);
    assertThat(offers.findById(loser.id()).orElseThrow().status()).isEqualTo(OfferStatus.REJECTED);
    assertThat(candidates.findById(ctx.candidateId).orElseThrow().hiredByFranchiseId())
        .contains(ctx.franchiseId);
  }

  @Test
  void resolve_withNoActiveOffers_noChange() {
    var ctx = seedLeague();

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 1);

    assertThat(candidates.findById(ctx.candidateId).orElseThrow().hiredByFranchiseId()).isEmpty();
    assertThat(staff.findAllForFranchise(ctx.leagueId, ctx.franchiseId)).isEmpty();
  }

  @Test
  void resolve_equalFootingV1_identicalStaticProfilesScoreEqually() {
    // When two franchises share the same static city triple (market/geo/climate), v1
    // equal-footing constants on dynamic dimensions guarantee identical composite scores.
    var allFranchises = new JooqFranchiseRepository(dsl).listAll();
    // Find two franchises whose static city triples match.
    FranchiseProfile a = null;
    FranchiseProfile b = null;
    for (var fa : allFranchises) {
      var pa = profiles.forFranchise(fa.id()).orElseThrow();
      for (var fb : allFranchises) {
        if (fa.id() == fb.id()) {
          continue;
        }
        var pb = profiles.forFranchise(fb.id()).orElseThrow();
        if (pa.marketSize() == pb.marketSize()
            && pa.geography() == pb.geography()
            && pa.climate() == pb.climate()) {
          a = pa;
          b = pb;
          break;
        }
      }
      if (a != null) {
        break;
      }
    }
    assertThat(a).describedAs("expected at least one matching city pair in seed data").isNotNull();

    var prefs = CandidateTestData.preferencesFor(1L);
    var terms = goodTerms();
    assertThat(OfferScoring.score(terms, a, prefs)).isEqualTo(OfferScoring.score(terms, b, prefs));
  }

  @Test
  void resolve_tieBrokenDeterministically_onlyOneWinner() {
    // Two franchises make byte-identical offers on the same candidate. Exactly one must be
    // accepted and one rejected — tie-break driven by the candidate's seeded RNG.
    var ctx = seedLeague();
    var offerA =
        offers.insertActive(
            ctx.candidateId, ctx.franchiseId, OfferTermsJson.toJson(goodTerms()), 1);
    var offerB =
        offers.insertActive(
            ctx.candidateId, ctx.otherFranchiseId, OfferTermsJson.toJson(goodTerms()), 1);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 1);

    var statuses =
        List.of(
            offers.findById(offerA.id()).orElseThrow().status(),
            offers.findById(offerB.id()).orElseThrow().status());
    assertThat(statuses).containsExactlyInAnyOrder(OfferStatus.ACCEPTED, OfferStatus.REJECTED);
    assertThat(candidates.findById(ctx.candidateId).orElseThrow().hiredByFranchiseId()).isPresent();
  }

  @Test
  void resolve_losingFranchise_remainsSearchingAndCanRebid() {
    var ctx = seedLeague();
    // Force the candidate's compensation to dominate the composite score so the good-offer
    // franchise always wins regardless of the random preferences the generator produced for this
    // specific seed. Without this the test is seed-sensitive — at some leagueId values the
    // candidate's random dimension weights make a low-comp offer competitive with good terms, and
    // the outcome flips.
    overwritePreferencesToDominateComp(ctx.candidateId);
    // Winner franchise has high offer; loser has low offer on same candidate.
    offers.insertActive(ctx.candidateId, ctx.franchiseId, OfferTermsJson.toJson(goodTerms()), 1);
    offers.insertActive(
        ctx.candidateId, ctx.otherFranchiseId, OfferTermsJson.toJson(lowCompOffer()), 1);

    resolver.resolve(ctx.leagueId, LeaguePhase.HIRING_HEAD_COACH, 1);

    // Loser still SEARCHING (never transitioned to HIRED).
    var loserState =
        hiringStates
            .find(ctx.leagueId, ctx.otherFranchiseId, LeaguePhase.HIRING_HEAD_COACH)
            .orElseThrow();
    assertThat(loserState.step()).isEqualTo(HiringStep.SEARCHING);

    // Loser can submit a new offer on a different candidate.
    var otherCandidate = candidates.findAllByPoolId(poolIdFor(ctx.leagueId)).get(1);
    var rebid =
        offers.insertActive(
            otherCandidate.id(), ctx.otherFranchiseId, OfferTermsJson.toJson(goodTerms()), 2);
    assertThat(rebid.status()).isEqualTo(OfferStatus.ACTIVE);
  }

  private void overwritePreferencesToDominateComp(long candidateId) {
    // Zero all non-comp weights, saturate the comp weight. Composite score then reduces to
    // numericFloorFit on compensation — good terms ($20M vs any target) = 1.0, low ($500k) = 0.0.
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

  private long poolIdFor(long leagueId) {
    return pools
        .findByLeaguePhaseAndType(
            leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH)
        .orElseThrow()
        .id();
  }

  private Ctx seedLeague() {
    var league = createLeagueFor("sub-" + System.nanoTime());
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    entryHandler.onEntry(league.id());
    var pool =
        pools
            .findByLeaguePhaseAndType(
                league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH)
            .orElseThrow();
    var firstCandidate = candidates.findAllByPoolId(pool.id()).getFirst();
    var allFranchises = new JooqFranchiseRepository(dsl).listAll();
    // League creation picks the first franchise; pick two arbitrary franchise ids for offers.
    var franchiseA = allFranchises.get(0).id();
    var franchiseB = allFranchises.get(1).id();
    // Initialize hiring states for both so the loser can be inspected.
    hiringStates.upsert(
        new FranchiseHiringState(
            0L,
            league.id(),
            franchiseB,
            LeaguePhase.HIRING_HEAD_COACH,
            HiringStep.SEARCHING,
            List.of(),
            List.of()));
    return new Ctx(league.id(), firstCandidate.id(), franchiseA, franchiseB);
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

  private record Ctx(long leagueId, long candidateId, long franchiseId, long otherFranchiseId) {}
}
