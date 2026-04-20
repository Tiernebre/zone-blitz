package app.zoneblitz.league.hiring;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.CreateLeague;
import app.zoneblitz.league.CreateLeagueResult;
import app.zoneblitz.league.CreateLeagueUseCase;
import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.League;
import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.staff.RoleScope;
import app.zoneblitz.league.staff.StaffContinuity;
import app.zoneblitz.league.team.JooqTeamLookup;
import app.zoneblitz.league.team.JooqTeamRepository;
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
class JooqDeclineCounterOfferUseCaseTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private JooqCandidateRepository candidates;
  private JooqCandidateOfferRepository offers;
  private CreateLeague createLeague;
  private DeclineCounterOffer declineCounterOffer;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    offers = new JooqCandidateOfferRepository(dsl);
    createLeague = new CreateLeagueUseCase(leagues, franchises, teamRepo);
    declineCounterOffer = new DeclineCounterOfferUseCase(leagues, offers);
  }

  @Test
  void decline_validCounter_rejectsOffer() {
    var ctx = seedLeagueAndPool("sub-1");
    var userOffer = offers.insertActive(ctx.candidateId, ctx.userTeamId, termsJson(4_000_000), 1);
    var competingOffer =
        offers.insertActive(ctx.candidateId, ctx.otherTeamId, termsJson(6_000_000), 1);
    offers.flipToCounterPending(userOffer.id(), competingOffer.id(), 5);

    var result = declineCounterOffer.decline(ctx.leagueId, userOffer.id(), "sub-1");

    assertThat(result).isInstanceOf(DeclineCounterOfferResult.Declined.class);
    assertThat(((DeclineCounterOfferResult.Declined) result).offerId()).isEqualTo(userOffer.id());
    var reloaded = offers.findById(userOffer.id()).orElseThrow();
    assertThat(reloaded.status()).isEqualTo(OfferStatus.REJECTED);
    assertThat(reloaded.competingOfferId()).isEmpty();
    assertThat(reloaded.counterDeadlineDay()).isEmpty();
  }

  @Test
  void decline_offerNotCounterPending_returnsNotCounterPending() {
    var ctx = seedLeagueAndPool("sub-1");
    var userOffer = offers.insertActive(ctx.candidateId, ctx.userTeamId, termsJson(4_000_000), 1);

    var result = declineCounterOffer.decline(ctx.leagueId, userOffer.id(), "sub-1");

    assertThat(result).isInstanceOf(DeclineCounterOfferResult.NotCounterPending.class);
  }

  @Test
  void decline_leagueNotFound_returnsNotFound() {
    var result = declineCounterOffer.decline(999_999L, 1L, "sub-1");

    assertThat(result).isInstanceOf(DeclineCounterOfferResult.NotFound.class);
  }

  @Test
  void decline_leagueNotOwned_returnsNotFound() {
    var ctx = seedLeagueAndPool("owner");
    var userOffer = offers.insertActive(ctx.candidateId, ctx.userTeamId, termsJson(4_000_000), 1);
    var competingOffer =
        offers.insertActive(ctx.candidateId, ctx.otherTeamId, termsJson(6_000_000), 1);
    offers.flipToCounterPending(userOffer.id(), competingOffer.id(), 5);

    var result = declineCounterOffer.decline(ctx.leagueId, userOffer.id(), "someone-else");

    assertThat(result).isInstanceOf(DeclineCounterOfferResult.NotFound.class);
  }

  private Ctx seedLeagueAndPool(String subject) {
    var league = createLeagueFor(subject);
    var pools = new JooqCandidatePoolRepository(dsl);
    var pool =
        pools.insert(league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    var candidateId = candidates.insert(CandidateTestData.newHeadCoach(pool.id())).id();
    var userTeamId =
        leagues.findSummaryByIdAndOwner(league.id(), subject).orElseThrow().userTeamId();
    var teamIds = new JooqTeamLookup(dsl).teamIdsForLeague(league.id());
    var otherTeamId =
        teamIds.stream()
            .mapToLong(Long::longValue)
            .filter(id -> id != userTeamId)
            .findFirst()
            .orElseThrow();
    return new Ctx(league.id(), candidateId, userTeamId, otherTeamId);
  }

  private League createLeagueFor(String ownerSubject) {
    var franchiseId = new JooqFranchiseRepository(dsl).listAll().getFirst().id();
    var result = createLeague.create(ownerSubject, "Dynasty", franchiseId);
    return ((CreateLeagueResult.Created) result).league();
  }

  private static String termsJson(long compensationDollars) {
    return OfferTermsJson.toJson(
        new OfferTerms(
            BigDecimal.valueOf(compensationDollars).setScale(2),
            5,
            new BigDecimal("0.85"),
            RoleScope.HIGH,
            StaffContinuity.BRING_OWN));
  }

  private record Ctx(long leagueId, long candidateId, long userTeamId, long otherTeamId) {}
}
