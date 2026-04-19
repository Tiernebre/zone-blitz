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
class MakeOfferUseCaseTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private JooqCandidateRepository candidates;
  private JooqCandidateOfferRepository offers;
  private JooqFranchiseHiringStateRepository hiringStates;
  private CreateLeague createLeague;
  private HiringHeadCoachTransitionHandler entryHandler;
  private MakeOffer makeOffer;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    var teams = new JooqTeamLookup(dsl);
    var pools = new JooqCandidatePoolRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    var preferences = new JooqCandidatePreferencesRepository(dsl);
    hiringStates = new JooqFranchiseHiringStateRepository(dsl);
    offers = new JooqCandidateOfferRepository(dsl);
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
            (leagueId, phase) -> new FakeRandomSource(leagueId + phase.ordinal()));
    makeOffer = new MakeOfferUseCase(leagues, pools, candidates, offers, hiringStates);
  }

  @Test
  void offer_whenValid_persistsActiveOffer() {
    var ctx = seedLeagueInPhase("sub-1");

    var result = makeOffer.offer(ctx.leagueId, ctx.firstCandidateId, "sub-1", terms());

    assertThat(result).isInstanceOf(MakeOfferResult.Created.class);
    var created = ((MakeOfferResult.Created) result).offer();
    assertThat(created.status()).isEqualTo(OfferStatus.ACTIVE);
    assertThat(created.candidateId()).isEqualTo(ctx.firstCandidateId);
    assertThat(created.submittedAtWeek()).isEqualTo(1);
    assertThat(offers.findActiveForCandidate(ctx.firstCandidateId)).hasSize(1);
  }

  @Test
  void offer_whenLeagueNotOwned_returnsNotFound() {
    var ctx = seedLeagueInPhase("owner");

    var result = makeOffer.offer(ctx.leagueId, ctx.firstCandidateId, "someone-else", terms());

    assertThat(result).isInstanceOf(MakeOfferResult.NotFound.class);
  }

  @Test
  void offer_whenCandidateUnknown_returnsUnknownCandidate() {
    var ctx = seedLeagueInPhase("sub-1");

    var result = makeOffer.offer(ctx.leagueId, 999_999L, "sub-1", terms());

    assertThat(result).isInstanceOf(MakeOfferResult.UnknownCandidate.class);
  }

  @Test
  void offer_whenCandidateAlreadyHired_returnsUnknownCandidate() {
    var ctx = seedLeagueInPhase("sub-1");
    candidates.markHired(ctx.firstCandidateId, ctx.otherFranchiseId);

    var result = makeOffer.offer(ctx.leagueId, ctx.firstCandidateId, "sub-1", terms());

    assertThat(result).isInstanceOf(MakeOfferResult.UnknownCandidate.class);
  }

  @Test
  void offer_whenFranchiseAlreadyHired_returnsAlreadyHired() {
    var ctx = seedLeagueInPhase("sub-1");
    hiringStates.upsert(
        new FranchiseHiringState(
            0L,
            ctx.leagueId,
            ctx.franchiseId,
            LeaguePhase.HIRING_HEAD_COACH,
            HiringStep.HIRED,
            List.of(),
            List.of()));

    var result = makeOffer.offer(ctx.leagueId, ctx.firstCandidateId, "sub-1", terms());

    assertThat(result).isInstanceOf(MakeOfferResult.AlreadyHired.class);
  }

  @Test
  void offer_whenActiveOfferExists_returnsActiveOfferExists() {
    var ctx = seedLeagueInPhase("sub-1");
    makeOffer.offer(ctx.leagueId, ctx.firstCandidateId, "sub-1", terms());

    var second = makeOffer.offer(ctx.leagueId, ctx.firstCandidateId, "sub-1", terms());

    assertThat(second).isInstanceOf(MakeOfferResult.ActiveOfferExists.class);
  }

  @Test
  void offer_whenPhaseNotHiringHeadCoach_returnsNotFound() {
    var league = createLeagueFor("sub-1");

    var result = makeOffer.offer(league.id(), 1L, "sub-1", terms());

    assertThat(result).isInstanceOf(MakeOfferResult.NotFound.class);
  }

  private Ctx seedLeagueInPhase(String subject) {
    var league = createLeagueFor(subject);
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    entryHandler.onEntry(league.id());
    var pool =
        new JooqCandidatePoolRepository(dsl)
            .findByLeaguePhaseAndType(
                league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH)
            .orElseThrow();
    var first = candidates.findAllByPoolId(pool.id()).getFirst();
    var franchises = new JooqFranchiseRepository(dsl).listAll();
    var userFranchiseId =
        leagues.findSummaryByIdAndOwner(league.id(), subject).orElseThrow().userFranchise().id();
    var otherFranchiseId =
        franchises.stream()
            .mapToLong(Franchise::id)
            .filter(id -> id != userFranchiseId)
            .findFirst()
            .orElseThrow();
    return new Ctx(league.id(), first.id(), userFranchiseId, otherFranchiseId);
  }

  private League createLeagueFor(String ownerSubject) {
    var franchiseId = new JooqFranchiseRepository(dsl).listAll().getFirst().id();
    var result = createLeague.create(ownerSubject, "Dynasty", franchiseId);
    return ((CreateLeagueResult.Created) result).league();
  }

  private static OfferTerms terms() {
    return new OfferTerms(
        new BigDecimal("8500000.00"),
        5,
        new BigDecimal("0.85"),
        RoleScope.HIGH,
        StaffContinuity.BRING_OWN);
  }

  private record Ctx(
      long leagueId, long firstCandidateId, long franchiseId, long otherFranchiseId) {}
}
