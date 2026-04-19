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
    assertThat(history).hasSize(StartInterview.DEFAULT_WEEKLY_CAPACITY);
    var state = hiringStates.find(cpuFranchiseId, LeaguePhase.HIRING_HEAD_COACH).orElseThrow();
    assertThat(state.step()).isEqualTo(HiringStep.SEARCHING);
    assertThat(state.interviewingCandidateIds()).hasSize(StartInterview.DEFAULT_WEEKLY_CAPACITY);
  }

  @Test
  void execute_submitsExactlyOneActiveOfferOnInterviewedCandidate() {
    var ctx = seedLeague("sub-1");
    var cpuFranchiseId = ctx.cpuFranchises().getFirst();

    strategy.execute(ctx.leagueId(), cpuFranchiseId, 1);

    var active = offers.findActiveForTeam(cpuFranchiseId);
    assertThat(active).hasSize(1);
    var interviewedIds =
        interviews.findAllFor(cpuFranchiseId, LeaguePhase.HIRING_HEAD_COACH).stream()
            .map(TeamInterview::candidateId)
            .toList();
    assertThat(interviewedIds).contains(active.getFirst().candidateId());
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
        .hasSize(1)
        .extracting(CandidateOffer::id)
        .containsExactlyElementsOf(week1Offers.stream().map(CandidateOffer::id).toList());
  }

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
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    entryHandler.onEntry(league.id());
    var cpuTeams = teamLookup.cpuTeamIdsForLeague(league.id());
    var userTeamId =
        leagues.findSummaryByIdAndOwner(league.id(), subject).orElseThrow().userTeamId();
    return new Ctx(league.id(), userTeamId, cpuTeams);
  }

  private record Ctx(long leagueId, long userTeamId, List<Long> cpuFranchises) {}
}
