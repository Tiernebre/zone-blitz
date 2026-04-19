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
import app.zoneblitz.league.staff.RoleScope;
import app.zoneblitz.league.staff.StaffContinuity;
import app.zoneblitz.league.team.JooqTeamHiringStateRepository;
import app.zoneblitz.league.team.JooqTeamLookup;
import app.zoneblitz.league.team.JooqTeamRepository;
import app.zoneblitz.league.team.TeamHiringState;
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
  private JooqTeamHiringStateRepository hiringStates;
  private JooqTeamInterviewRepository interviews;
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
    hiringStates = new JooqTeamHiringStateRepository(dsl);
    offers = new JooqCandidateOfferRepository(dsl);
    interviews = new JooqTeamInterviewRepository(dsl);
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
            (leagueId, phase) -> new FakeRandomSource(leagueId + phase.ordinal()));
    makeOffer = new MakeOfferUseCase(leagues, pools, candidates, offers, hiringStates, interviews);
  }

  @Test
  void offer_whenValid_persistsActiveOffer() {
    var ctx = seedLeagueInPhase("sub-1");
    seedInterview(ctx, InterviewInterest.INTERESTED);

    var result = makeOffer.offer(ctx.leagueId, ctx.firstCandidateId, "sub-1", terms());

    assertThat(result).isInstanceOf(MakeOfferResult.Created.class);
    var created = ((MakeOfferResult.Created) result).offer();
    assertThat(created.status()).isEqualTo(OfferStatus.ACTIVE);
    assertThat(created.candidateId()).isEqualTo(ctx.firstCandidateId);
    assertThat(created.submittedAtWeek()).isEqualTo(1);
    assertThat(created.stance()).contains(OfferStance.PENDING);
    assertThat(created.revisionCount()).isEqualTo(0);
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
    candidates.markHired(ctx.firstCandidateId, ctx.otherTeamId);

    var result = makeOffer.offer(ctx.leagueId, ctx.firstCandidateId, "sub-1", terms());

    assertThat(result).isInstanceOf(MakeOfferResult.UnknownCandidate.class);
  }

  @Test
  void offer_whenNotInterviewed_returnsCandidateNotInterested() {
    var ctx = seedLeagueInPhase("sub-1");

    var result = makeOffer.offer(ctx.leagueId, ctx.firstCandidateId, "sub-1", terms());

    assertThat(result).isInstanceOf(MakeOfferResult.CandidateNotInterested.class);
  }

  @Test
  void offer_whenInterestIsNotInterested_returnsCandidateNotInterested() {
    var ctx = seedLeagueInPhase("sub-1");
    seedInterview(ctx, InterviewInterest.NOT_INTERESTED);

    var result = makeOffer.offer(ctx.leagueId, ctx.firstCandidateId, "sub-1", terms());

    assertThat(result).isInstanceOf(MakeOfferResult.CandidateNotInterested.class);
  }

  @Test
  void offer_whenTeamAlreadyHired_returnsAlreadyHired() {
    var ctx = seedLeagueInPhase("sub-1");
    hiringStates.upsert(
        new TeamHiringState(
            0L, ctx.userTeamId, LeaguePhase.HIRING_HEAD_COACH, HiringStep.HIRED, List.of()));

    var result = makeOffer.offer(ctx.leagueId, ctx.firstCandidateId, "sub-1", terms());

    assertThat(result).isInstanceOf(MakeOfferResult.AlreadyHired.class);
  }

  @Test
  void offer_whenActiveOfferExists_revisesInPlace() {
    var ctx = seedLeagueInPhase("sub-1");
    seedInterview(ctx, InterviewInterest.INTERESTED);
    var first =
        ((MakeOfferResult.Created)
                makeOffer.offer(ctx.leagueId, ctx.firstCandidateId, "sub-1", terms()))
            .offer();

    var second = makeOffer.offer(ctx.leagueId, ctx.firstCandidateId, "sub-1", terms());

    assertThat(second).isInstanceOf(MakeOfferResult.Created.class);
    var revised = ((MakeOfferResult.Created) second).offer();
    assertThat(revised.id()).isEqualTo(first.id());
    assertThat(revised.revisionCount()).isEqualTo(1);
    assertThat(offers.findActiveForCandidate(ctx.firstCandidateId)).hasSize(1);
  }

  @Test
  void offer_whenPhaseNotHiringHeadCoach_returnsNotFound() {
    var league = createLeagueFor("sub-1");

    var result = makeOffer.offer(league.id(), 1L, "sub-1", terms());

    assertThat(result).isInstanceOf(MakeOfferResult.NotFound.class);
  }

  private void seedInterview(Ctx ctx, InterviewInterest interest) {
    interviews.insert(
        new NewTeamInterview(
            ctx.userTeamId, ctx.firstCandidateId, LeaguePhase.HIRING_HEAD_COACH, 1, 1, interest));
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
    var userTeamId =
        leagues.findSummaryByIdAndOwner(league.id(), subject).orElseThrow().userTeamId();
    var teamIds = new JooqTeamLookup(dsl).teamIdsForLeague(league.id());
    var otherTeamId =
        teamIds.stream()
            .mapToLong(Long::longValue)
            .filter(id -> id != userTeamId)
            .findFirst()
            .orElse(userTeamId + 1);
    return new Ctx(league.id(), first.id(), userTeamId, otherTeamId);
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

  private record Ctx(long leagueId, long firstCandidateId, long userTeamId, long otherTeamId) {}
}
