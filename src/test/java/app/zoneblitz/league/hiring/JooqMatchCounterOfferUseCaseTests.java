package app.zoneblitz.league.hiring;

import static app.zoneblitz.jooq.Tables.TEAMS;
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
class JooqMatchCounterOfferUseCaseTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private JooqCandidateRepository candidates;
  private JooqCandidateOfferRepository offers;
  private JooqStaffBudgetRepository budgets;
  private CreateLeague createLeague;
  private MatchCounterOffer matchCounterOffer;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    offers = new JooqCandidateOfferRepository(dsl);
    budgets = new JooqStaffBudgetRepository(dsl);
    createLeague = new CreateLeagueUseCase(leagues, franchises, teamRepo);
    matchCounterOffer = new MatchCounterOfferUseCase(leagues, offers, budgets);
  }

  @Test
  void match_validCounter_flipsToActiveWithCompetingTerms() {
    var ctx = seedLeagueAndPool("sub-1");
    var userOffer = offers.insertActive(ctx.candidateId, ctx.userTeamId, termsJson(4_000_000), 1);
    var competingOffer =
        offers.insertActive(ctx.candidateId, ctx.otherTeamId, termsJson(6_000_000), 1);
    offers.flipToCounterPending(userOffer.id(), competingOffer.id(), 5);

    var result = matchCounterOffer.match(ctx.leagueId, userOffer.id(), "sub-1");

    assertThat(result).isInstanceOf(MatchCounterOfferResult.Matched.class);
    var matched = ((MatchCounterOfferResult.Matched) result).offer();
    assertThat(matched.status()).isEqualTo(OfferStatus.ACTIVE);
    assertThat(matched.stance()).contains(OfferStance.PENDING);
    assertThat(matched.competingOfferId()).isEmpty();
    assertThat(matched.counterDeadlineDay()).isEmpty();
    assertThat(matched.revisionCount()).isEqualTo(1);
    var terms = OfferTermsJson.fromJson(matched.terms());
    assertThat(terms.compensation()).isEqualByComparingTo(new BigDecimal("6000000"));
  }

  @Test
  void match_budgetExceeded_returnsInsufficientBudget() {
    var ctx = seedLeagueAndPool("sub-1");
    setBudget(ctx.userTeamId, 5_000_000_00L);
    var userOffer = offers.insertActive(ctx.candidateId, ctx.userTeamId, termsJson(3_000_000), 1);
    var competingOffer =
        offers.insertActive(ctx.candidateId, ctx.otherTeamId, termsJson(9_000_000), 1);
    offers.flipToCounterPending(userOffer.id(), competingOffer.id(), 5);

    var result = matchCounterOffer.match(ctx.leagueId, userOffer.id(), "sub-1");

    assertThat(result).isInstanceOf(MatchCounterOfferResult.InsufficientBudget.class);
    var insufficient = (MatchCounterOfferResult.InsufficientBudget) result;
    assertThat(insufficient.teamId()).isEqualTo(ctx.userTeamId);
    assertThat(insufficient.requiredCents()).isEqualTo(9_000_000_00L);
    // offer still COUNTER_PENDING
    var reloaded = offers.findById(userOffer.id()).orElseThrow();
    assertThat(reloaded.status()).isEqualTo(OfferStatus.COUNTER_PENDING);
  }

  @Test
  void match_offerNotCounterPending_returnsNotCounterPending() {
    var ctx = seedLeagueAndPool("sub-1");
    var userOffer = offers.insertActive(ctx.candidateId, ctx.userTeamId, termsJson(4_000_000), 1);

    var result = matchCounterOffer.match(ctx.leagueId, userOffer.id(), "sub-1");

    assertThat(result).isInstanceOf(MatchCounterOfferResult.NotCounterPending.class);
  }

  @Test
  void match_deadlineExpired_returnsDeadlineExpired() {
    var ctx = seedLeagueAndPool("sub-1");
    var userOffer = offers.insertActive(ctx.candidateId, ctx.userTeamId, termsJson(4_000_000), 1);
    var competingOffer =
        offers.insertActive(ctx.candidateId, ctx.otherTeamId, termsJson(6_000_000), 1);
    offers.flipToCounterPending(userOffer.id(), competingOffer.id(), 3);
    for (var i = 0; i < 5; i++) {
      leagues.incrementPhaseDay(ctx.leagueId);
    }

    var result = matchCounterOffer.match(ctx.leagueId, userOffer.id(), "sub-1");

    assertThat(result).isInstanceOf(MatchCounterOfferResult.DeadlineExpired.class);
    var expired = (MatchCounterOfferResult.DeadlineExpired) result;
    assertThat(expired.deadlineDay()).isEqualTo(3);
    assertThat(expired.currentDay()).isEqualTo(6);
  }

  @Test
  void match_leagueNotOwned_returnsNotFound() {
    var ctx = seedLeagueAndPool("owner");
    var userOffer = offers.insertActive(ctx.candidateId, ctx.userTeamId, termsJson(4_000_000), 1);
    var competingOffer =
        offers.insertActive(ctx.candidateId, ctx.otherTeamId, termsJson(6_000_000), 1);
    offers.flipToCounterPending(userOffer.id(), competingOffer.id(), 5);

    var result = matchCounterOffer.match(ctx.leagueId, userOffer.id(), "someone-else");

    assertThat(result).isInstanceOf(MatchCounterOfferResult.NotFound.class);
  }

  @Test
  void match_leagueNotFound_returnsNotFound() {
    var result = matchCounterOffer.match(999_999L, 1L, "sub-1");

    assertThat(result).isInstanceOf(MatchCounterOfferResult.NotFound.class);
  }

  @Test
  void match_offerOnDifferentTeam_returnsNotFound() {
    var ctx = seedLeagueAndPool("sub-1");
    var otherOffer = offers.insertActive(ctx.candidateId, ctx.otherTeamId, termsJson(4_000_000), 1);

    var result = matchCounterOffer.match(ctx.leagueId, otherOffer.id(), "sub-1");

    assertThat(result).isInstanceOf(MatchCounterOfferResult.NotFound.class);
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
    // Default test budget ceiling so normal match cases don't trip the budget check.
    setBudget(userTeamId, 25_000_000_00L);
    return new Ctx(league.id(), candidateId, userTeamId, otherTeamId);
  }

  private League createLeagueFor(String ownerSubject) {
    var franchiseId = new JooqFranchiseRepository(dsl).listAll().getFirst().id();
    var result = createLeague.create(ownerSubject, "Dynasty", franchiseId);
    return ((CreateLeagueResult.Created) result).league();
  }

  private void setBudget(long teamId, long cents) {
    dsl.update(TEAMS).set(TEAMS.STAFF_BUDGET_CENTS, cents).where(TEAMS.ID.eq(teamId)).execute();
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
