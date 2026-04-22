package app.zoneblitz.league.hiring.hire;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.CreateLeague;
import app.zoneblitz.league.CreateLeagueResult;
import app.zoneblitz.league.CreateLeagueUseCase;
import app.zoneblitz.league.FakeRandomSource;
import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.hiring.CandidateOffer;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.CandidateRandomSources;
import app.zoneblitz.league.hiring.InterviewInterest;
import app.zoneblitz.league.hiring.MakeOffer;
import app.zoneblitz.league.hiring.StartInterview;
import app.zoneblitz.league.hiring.candidates.JooqCandidatePoolRepository;
import app.zoneblitz.league.hiring.candidates.JooqCandidatePreferencesRepository;
import app.zoneblitz.league.hiring.candidates.JooqCandidateRepository;
import app.zoneblitz.league.hiring.generation.HeadCoachGenerator;
import app.zoneblitz.league.hiring.interview.JooqTeamInterviewRepository;
import app.zoneblitz.league.hiring.interview.TeamInterview;
import app.zoneblitz.league.hiring.offer.JooqCandidateOfferRepository;
import app.zoneblitz.league.phase.HiringHeadCoachTransitionHandler;
import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.staff.JooqTeamStaffRepository;
import app.zoneblitz.league.team.CityTeamProfiles;
import app.zoneblitz.league.team.JooqTeamHiringStateRepository;
import app.zoneblitz.league.team.JooqTeamLookup;
import app.zoneblitz.league.team.JooqTeamRepository;
import app.zoneblitz.league.team.TeamHiringState;
import app.zoneblitz.league.team.TeamLookup;
import app.zoneblitz.league.team.TeamProfiles;
import app.zoneblitz.support.PostgresTestcontainer;
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
  private TeamLookup teamLookup;
  private CreateLeague createLeague;
  private HiringHeadCoachTransitionHandler entryHandler;
  private CpuHiringStrategy strategy;

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
    new JooqTeamStaffRepository(dsl);
    TeamProfiles profiles = new CityTeamProfiles(dsl, franchiseRepo);
    CandidateRandomSources rngs =
        (leagueId, phase) -> new FakeRandomSource(leagueId * 31 + phase.ordinal());
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
            profiles);
  }

  @Test
  void execute_week1_runsInterviewsUpToCapacity() {
    var ctx = seedLeague("sub-1");
    var cpuFranchiseId = ctx.cpuFranchises().getFirst();

    strategy.execute(ctx.leagueId(), cpuFranchiseId, 1);

    var history = interviews.findAllFor(cpuFranchiseId, LeaguePhase.HIRING_HEAD_COACH);
    assertThat(history).hasSize(StartInterview.DAILY_CAPACITY);
    var state = hiringStates.find(cpuFranchiseId, LeaguePhase.HIRING_HEAD_COACH).orElseThrow();
    assertThat(state.step()).isEqualTo(HiringStep.SEARCHING);
    assertThat(state.interviewingCandidateIds()).hasSize(StartInterview.DAILY_CAPACITY);
  }

  @Test
  void execute_holdsOfferDuringInterviewOnlyWindow() {
    var ctx = seedLeague("sub-1");
    var cpuFranchiseId = ctx.cpuFranchises().getFirst();

    for (var day = 1; day < MakeOffer.OFFERS_OPEN_ON_DAY; day++) {
      strategy.execute(ctx.leagueId(), cpuFranchiseId, day);
    }

    assertThat(offers.findActiveForTeam(cpuFranchiseId))
        .as("no offer before the league-wide interview-only window closes")
        .isEmpty();
  }

  @Test
  void execute_submitsExactlyOneActiveOfferOnceOffersOpen() {
    var ctx = seedLeague("sub-1");
    var cpuFranchiseId = ctx.cpuFranchises().getFirst();

    runUntilOfferSubmitted(ctx.leagueId(), cpuFranchiseId);

    var active = offers.findActiveForTeam(cpuFranchiseId);
    assertThat(active).hasSize(1);
    var interviewedIds =
        interviews.findAllFor(cpuFranchiseId, LeaguePhase.HIRING_HEAD_COACH).stream()
            .map(TeamInterview::candidateId)
            .toList();
    assertThat(interviewedIds).contains(active.getFirst().candidateId());
  }

  @Test
  void execute_prioritizesInterestedCandidatesOverLukewarm() {
    var ctx = seedLeague("sub-1");
    var cpuFranchiseId = ctx.cpuFranchises().getFirst();

    var offeredCandidateId = runUntilOfferSubmitted(ctx.leagueId(), cpuFranchiseId).candidateId();

    var interest =
        interviews.findAllFor(cpuFranchiseId, LeaguePhase.HIRING_HEAD_COACH).stream()
            .filter(i -> i.candidateId() == offeredCandidateId)
            .findFirst()
            .map(TeamInterview::interestLevel)
            .orElseThrow();
    var anyInterested =
        interviews.findAllFor(cpuFranchiseId, LeaguePhase.HIRING_HEAD_COACH).stream()
            .anyMatch(i -> i.interestLevel() == InterviewInterest.INTERESTED);
    if (anyInterested) {
      assertThat(interest).isEqualTo(InterviewInterest.INTERESTED);
    }
  }

  @Test
  void execute_nextDay_doesNotSubmitSecondOfferWhilePriorIsActive() {
    var ctx = seedLeague("sub-1");
    var cpuFranchiseId = ctx.cpuFranchises().getFirst();
    var submitted = runUntilOfferSubmitted(ctx.leagueId(), cpuFranchiseId);
    var priorOffers = offers.findActiveForTeam(cpuFranchiseId);

    strategy.execute(ctx.leagueId(), cpuFranchiseId, submitted.dayAtOffer() + 1);

    var nextOffers = offers.findActiveForTeam(cpuFranchiseId);
    assertThat(nextOffers)
        .hasSize(1)
        .extracting(CandidateOffer::id)
        .containsExactlyElementsOf(priorOffers.stream().map(CandidateOffer::id).toList());
  }

  private SubmittedOffer runUntilOfferSubmitted(long leagueId, long cpuTeamId) {
    int day = 0;
    while (offers.findActiveForTeam(cpuTeamId).isEmpty() && day < 15) {
      day++;
      strategy.execute(leagueId, cpuTeamId, day);
    }
    var active = offers.findActiveForTeam(cpuTeamId);
    assertThat(active).as("CPU should have submitted an offer within the loop").hasSize(1);
    return new SubmittedOffer(active.getFirst().candidateId(), day);
  }

  private record SubmittedOffer(long candidateId, int dayAtOffer) {}

  @Test
  void execute_whenAlreadyHired_skipsAllWork() {
    var ctx = seedLeague("sub-1");
    var cpuFranchiseId = ctx.cpuFranchises().getFirst();
    hiringStates.upsert(
        new TeamHiringState(
            0L, cpuFranchiseId, LeaguePhase.HIRING_HEAD_COACH, HiringStep.HIRED, List.of()));

    strategy.execute(ctx.leagueId(), cpuFranchiseId, 1);

    assertThat(offers.findActiveForTeam(cpuFranchiseId)).isEmpty();
    assertThat(interviews.findAllFor(cpuFranchiseId, LeaguePhase.HIRING_HEAD_COACH)).isEmpty();
  }

  private Ctx seedLeague(String subject) {
    var franchises = new JooqFranchiseRepository(dsl).listAll();
    var userFranchiseId = franchises.getFirst().id();
    var result = createLeague.create(subject, "Dynasty-" + subject, userFranchiseId);
    var league = ((CreateLeagueResult.Created) result).league();
    leagues.updatePhaseAndResetDay(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    entryHandler.onEntry(league.id());
    var cpuTeams = teamLookup.cpuTeamIdsForLeague(league.id());
    var userTeamId =
        leagues.findSummaryByIdAndOwner(league.id(), subject).orElseThrow().userTeamId();
    return new Ctx(league.id(), userTeamId, cpuTeams);
  }

  private record Ctx(long leagueId, long userTeamId, List<Long> cpuFranchises) {}
}
