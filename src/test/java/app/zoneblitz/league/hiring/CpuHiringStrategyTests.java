package app.zoneblitz.league.hiring;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.CreateLeague;
import app.zoneblitz.league.CreateLeagueResult;
import app.zoneblitz.league.CreateLeagueUseCase;
import app.zoneblitz.league.FakeRandomSource;
import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.phase.HiringHeadCoachTransitionHandler;
import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.staff.JooqTeamStaffRepository;
import app.zoneblitz.league.staff.RoleScope;
import app.zoneblitz.league.staff.StaffContinuity;
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
class CpuHiringStrategyTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private JooqCandidatePoolRepository pools;
  private JooqCandidateRepository candidates;
  private JooqCandidatePreferencesRepository preferences;
  private JooqCandidateOfferRepository offers;
  private JooqTeamHiringStateRepository hiringStates;
  private JooqTeamInterviewRepository interviews;
  private JooqTeamStaffRepository staff;
  private TeamProfiles profiles;
  private TeamLookup teamLookup;
  private CreateLeague createLeague;
  private HiringHeadCoachTransitionHandler entryHandler;
  private CandidateRandomSources rngs;
  private CpuHiringStrategy strategy;
  private PreferenceScoringOfferResolver resolver;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    var franchiseRepo = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    teamLookup = new JooqTeamLookup(dsl);
    pools = new JooqCandidatePoolRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    preferences = new JooqCandidatePreferencesRepository(dsl);
    offers = new JooqCandidateOfferRepository(dsl);
    hiringStates = new JooqTeamHiringStateRepository(dsl);
    interviews = new JooqTeamInterviewRepository(dsl);
    staff = new JooqTeamStaffRepository(dsl);
    profiles = new CityTeamProfiles(dsl, franchiseRepo);
    rngs = (leagueId, phase) -> new FakeRandomSource(leagueId * 31 + phase.ordinal());
    createLeague = new CreateLeagueUseCase(leagues, franchiseRepo, teamRepo);
    entryHandler =
        new HiringHeadCoachTransitionHandler(
            leagues,
            teamLookup,
            pools,
            candidates,
            preferences,
            hiringStates,
            new HeadCoachGenerator(app.zoneblitz.names.CuratedNameGenerator.maleDefaults()),
            rngs);
    strategy =
        new CpuHiringStrategy(
            LeaguePhase.HIRING_HEAD_COACH,
            CandidatePoolType.HEAD_COACH,
            pools,
            candidates,
            preferences,
            offers,
            hiringStates,
            interviews,
            rngs);
    resolver =
        new PreferenceScoringOfferResolver(
            offers, candidates, pools, preferences, profiles, hiringStates, staff, rngs);
  }

  @Test
  void execute_week1_buildsShortlistAndRunsInterviews() {
    var ctx = seedLeague("sub-1");
    var cpuFranchiseId = ctx.cpuFranchises().getFirst();

    strategy.execute(ctx.leagueId(), cpuFranchiseId, 1);

    var state = hiringStates.find(cpuFranchiseId, LeaguePhase.HIRING_HEAD_COACH).orElseThrow();
    assertThat(state.shortlist()).hasSize(CpuHiringStrategy.SHORTLIST_SIZE);
    assertThat(state.step()).isEqualTo(HiringStep.SEARCHING);

    var history = interviews.findAllFor(cpuFranchiseId, LeaguePhase.HIRING_HEAD_COACH);
    assertThat(history).hasSize(StartInterview.DEFAULT_WEEKLY_CAPACITY);
    assertThat(history).allSatisfy(h -> assertThat(state.shortlist()).contains(h.candidateId()));
  }

  @Test
  void execute_submitsExactlyOneActiveOfferOnShortlistedCandidate() {
    var ctx = seedLeague("sub-1");
    var cpuFranchiseId = ctx.cpuFranchises().getFirst();

    strategy.execute(ctx.leagueId(), cpuFranchiseId, 1);

    var active = offers.findActiveForTeam(cpuFranchiseId);
    assertThat(active).hasSize(1);
    var state = hiringStates.find(cpuFranchiseId, LeaguePhase.HIRING_HEAD_COACH).orElseThrow();
    assertThat(state.shortlist()).contains(active.getFirst().candidateId());
  }

  @Test
  void execute_nextWeek_doesNotSubmitSecondOfferWhilePriorIsActive() {
    var ctx = seedLeague("sub-1");
    var cpuFranchiseId = ctx.cpuFranchises().getFirst();
    strategy.execute(ctx.leagueId(), cpuFranchiseId, 1);
    var week1Offers = offers.findActiveForTeam(cpuFranchiseId);

    strategy.execute(ctx.leagueId(), cpuFranchiseId, 2);

    var week2Offers = offers.findActiveForTeam(cpuFranchiseId);
    assertThat(week2Offers)
        .describedAs("still one active offer; no duplicate submitted")
        .hasSize(1)
        .extracting(CandidateOffer::id)
        .containsExactlyElementsOf(week1Offers.stream().map(CandidateOffer::id).toList());
  }

  @Test
  void execute_advancesThroughStepsEachWeek_interviewCountGrows() {
    var ctx = seedLeague("sub-1");
    var cpuFranchiseId = ctx.cpuFranchises().getFirst();

    strategy.execute(ctx.leagueId(), cpuFranchiseId, 1);
    var week1Count = interviews.findAllFor(cpuFranchiseId, LeaguePhase.HIRING_HEAD_COACH).size();
    strategy.execute(ctx.leagueId(), cpuFranchiseId, 2);
    var week2Count = interviews.findAllFor(cpuFranchiseId, LeaguePhase.HIRING_HEAD_COACH).size();

    assertThat(week1Count).isEqualTo(StartInterview.DEFAULT_WEEKLY_CAPACITY);
    assertThat(week2Count).isGreaterThan(week1Count);
  }

  @Test
  void execute_whenAlreadyHired_skipsAllWork() {
    var ctx = seedLeague("sub-1");
    var cpuFranchiseId = ctx.cpuFranchises().getFirst();
    hiringStates.upsert(
        new TeamHiringState(
            0L,
            cpuFranchiseId,
            LeaguePhase.HIRING_HEAD_COACH,
            HiringStep.HIRED,
            List.of(),
            List.of()));

    strategy.execute(ctx.leagueId(), cpuFranchiseId, 1);

    assertThat(offers.findActiveForTeam(cpuFranchiseId)).isEmpty();
    assertThat(interviews.findAllFor(cpuFranchiseId, LeaguePhase.HIRING_HEAD_COACH)).isEmpty();
  }

  @Test
  void execute_isDeterministicAcrossRuns_givenSameSeed() {
    var ctxA = seedLeague("sub-A");
    var cpuA = ctxA.cpuFranchises().getFirst();
    strategy.execute(ctxA.leagueId(), cpuA, 1);
    var stateA = hiringStates.find(cpuA, LeaguePhase.HIRING_HEAD_COACH).orElseThrow();
    var offersA = offers.findActiveForTeam(cpuA);

    var ctxB = seedLeague("sub-B");
    var cpuB = ctxB.cpuFranchises().getFirst();
    strategy.execute(ctxB.leagueId(), cpuB, 1);
    var stateB = hiringStates.find(cpuB, LeaguePhase.HIRING_HEAD_COACH).orElseThrow();
    var offersB = offers.findActiveForTeam(cpuB);

    assertThat(stateB.shortlist().size()).isEqualTo(stateA.shortlist().size());
    assertThat(offersB).hasSameSizeAs(offersA);
  }

  @Test
  void execute_cpuOutbidsUserOnTopCandidate_winsResolution() {
    var ctx = seedLeague("sub-1");
    var cpuFranchiseId = ctx.cpuFranchises().getFirst();

    // Precompute the candidate CPU will pick (top scouted overall) so user can pre-empt with a
    // deliberately weak offer on the same candidate.
    var topCandidate = topCandidateByScouted(ctx.leagueId());
    var userFranchiseId = ctx.userTeamId();
    // Initialize user's hiring state so resolver can flip loser back to SEARCHING cleanly.
    hiringStates.upsert(
        new TeamHiringState(
            0L,
            userFranchiseId,
            LeaguePhase.HIRING_HEAD_COACH,
            HiringStep.SEARCHING,
            List.of(),
            List.of()));
    offers.insertActive(topCandidate.id(), userFranchiseId, OfferTermsJson.toJson(weakOffer()), 1);

    strategy.execute(ctx.leagueId(), cpuFranchiseId, 1);
    resolver.resolve(ctx.leagueId(), LeaguePhase.HIRING_HEAD_COACH, 1);

    assertThat(candidates.findById(topCandidate.id()).orElseThrow().hiredByTeamId())
        .contains(cpuFranchiseId);
    var cpuState = hiringStates.find(cpuFranchiseId, LeaguePhase.HIRING_HEAD_COACH).orElseThrow();
    assertThat(cpuState.step()).isEqualTo(HiringStep.HIRED);
  }

  @Test
  void execute_snipesShortlistedCandidateWhenUserHasNotOffered() {
    var ctx = seedLeague("sub-1");
    var cpuFranchiseId = ctx.cpuFranchises().getFirst();
    var topCandidate = topCandidateByScouted(ctx.leagueId());

    // User shortlists the candidate but submits no offer.
    hiringStates.upsert(
        new TeamHiringState(
            0L,
            ctx.userTeamId(),
            LeaguePhase.HIRING_HEAD_COACH,
            HiringStep.SEARCHING,
            List.of(topCandidate.id()),
            List.of()));

    strategy.execute(ctx.leagueId(), cpuFranchiseId, 1);
    resolver.resolve(ctx.leagueId(), LeaguePhase.HIRING_HEAD_COACH, 1);

    assertThat(candidates.findById(topCandidate.id()).orElseThrow().hiredByTeamId())
        .contains(cpuFranchiseId);
  }

  private Candidate topCandidateByScouted(long leagueId) {
    var pool =
        pools
            .findByLeaguePhaseAndType(
                leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH)
            .orElseThrow();
    return candidates.findAllByPoolId(pool.id()).stream()
        .filter(c -> c.hiredByTeamId().isEmpty())
        .max(java.util.Comparator.comparingDouble(c -> extractScouted(c.scoutedAttrs())))
        .orElseThrow();
  }

  private static double extractScouted(String json) {
    var m =
        java.util.regex.Pattern.compile("\"overall\"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)")
            .matcher(json);
    return m.find() ? Double.parseDouble(m.group(1)) : 0.0;
  }

  private static OfferTerms weakOffer() {
    return new OfferTerms(
        new BigDecimal("100000.00"),
        1,
        new BigDecimal("0.01"),
        RoleScope.LOW,
        StaffContinuity.KEEP_EXISTING);
  }

  private Ctx seedLeague(String subject) {
    var franchises = new JooqFranchiseRepository(dsl).listAll();
    var userFranchiseId = franchises.getFirst().id();
    var result = createLeague.create(subject, "Dynasty-" + subject, userFranchiseId);
    var league = ((CreateLeagueResult.Created) result).league();
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    entryHandler.onEntry(league.id());
    var cpuTeams = teamLookup.cpuTeamIdsForLeague(league.id());
    var userTeamId =
        leagues.findSummaryByIdAndOwner(league.id(), subject).orElseThrow().userTeamId();
    return new Ctx(league.id(), userTeamId, cpuTeams);
  }

  private record Ctx(long leagueId, long userTeamId, List<Long> cpuFranchises) {}
}
