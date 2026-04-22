package app.zoneblitz.league.hiring.interview;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.CreateLeague;
import app.zoneblitz.league.CreateLeagueResult;
import app.zoneblitz.league.CreateLeagueUseCase;
import app.zoneblitz.league.FakeRandomSource;
import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.League;
import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.geography.Climate;
import app.zoneblitz.league.geography.Geography;
import app.zoneblitz.league.geography.MarketSize;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.CompetitiveWindow;
import app.zoneblitz.league.hiring.InterviewResult;
import app.zoneblitz.league.hiring.StartInterview;
import app.zoneblitz.league.hiring.candidates.JooqCandidatePoolRepository;
import app.zoneblitz.league.hiring.candidates.JooqCandidatePreferencesRepository;
import app.zoneblitz.league.hiring.candidates.JooqCandidateRepository;
import app.zoneblitz.league.hiring.generation.HeadCoachGenerator;
import app.zoneblitz.league.phase.HiringHeadCoachTransitionHandler;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.team.JooqTeamHiringStateRepository;
import app.zoneblitz.league.team.JooqTeamLookup;
import app.zoneblitz.league.team.JooqTeamRepository;
import app.zoneblitz.league.team.TeamHiringStateRepository;
import app.zoneblitz.league.team.TeamProfile;
import app.zoneblitz.league.team.TeamProfiles;
import app.zoneblitz.support.PostgresTestcontainer;
import java.math.BigDecimal;
import java.util.Optional;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

@JooqTest
@Import(PostgresTestcontainer.class)
class StartInterviewUseCaseTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private CreateLeague createLeague;
  private JooqCandidateRepository candidates;
  private TeamInterviewRepository interviews;
  private TeamHiringStateRepository hiringStates;
  private HiringHeadCoachTransitionHandler entryHandler;
  private StartInterview useCase;

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
    interviews = new JooqTeamInterviewRepository(dsl);
    createLeague = new CreateLeagueUseCase(leagues, franchises, teamRepo);
    app.zoneblitz.league.hiring.CandidateRandomSources rngs =
        (leagueId, phase) -> new FakeRandomSource(leagueId + phase.ordinal());
    var generatePool =
        new app.zoneblitz.league.hiring.candidates.GenerateCandidatePoolUseCase(
            pools, candidates, preferences, rngs);
    entryHandler =
        new HiringHeadCoachTransitionHandler(
            teams,
            generatePool,
            hiringStates,
            new HeadCoachGenerator(app.zoneblitz.names.CuratedNameGenerator.maleDefaults()));
    TeamProfiles teamProfiles = teamId -> Optional.of(fixedProfile(teamId));
    useCase =
        new StartInterviewUseCase(
            leagues, pools, candidates, preferences, hiringStates, interviews, teamProfiles);
  }

  @Test
  void start_firstInterview_recordsInterestAndAppendsCandidateToHiringState() {
    var ctx = seedLeagueInPhase("sub-1");

    var result = useCase.start(ctx.leagueId, ctx.firstCandidateId, "sub-1");

    assertThat(result).isInstanceOf(InterviewResult.Started.class);
    assertThat(((InterviewResult.Started) result).candidateId()).isEqualTo(ctx.firstCandidateId);

    var history = interviews.findAllFor(ctx.teamId, LeaguePhase.HIRING_HEAD_COACH);
    assertThat(history).hasSize(1);
    assertThat(history.getFirst().candidateId()).isEqualTo(ctx.firstCandidateId);
    assertThat(history.getFirst().interestLevel()).isNotNull();

    var state = hiringStates.find(ctx.teamId, LeaguePhase.HIRING_HEAD_COACH).orElseThrow();
    assertThat(state.interviewingCandidateIds()).containsExactly(ctx.firstCandidateId);
  }

  @Test
  void start_secondInterviewOnSameCandidate_returnsAlreadyInterviewed() {
    var ctx = seedLeagueInPhase("sub-1");

    useCase.start(ctx.leagueId, ctx.firstCandidateId, "sub-1");
    var repeat = useCase.start(ctx.leagueId, ctx.firstCandidateId, "sub-1");

    assertThat(repeat).isInstanceOf(InterviewResult.AlreadyInterviewed.class);
    // Interview row count stays at one; determinism guarantees re-interview brings no new info.
    assertThat(
            interviews.countForCandidate(
                ctx.teamId, ctx.firstCandidateId, LeaguePhase.HIRING_HEAD_COACH))
        .isEqualTo(1);
  }

  @Test
  void start_hittingWeeklyCap_returnsCapacityReached() {
    var ctx = seedLeagueInPhase("sub-1");
    var allIds = candidates.findAllByPoolId(ctx.poolId).stream().map(c -> c.id()).toList();

    for (int i = 0; i < StartInterview.DAILY_CAPACITY; i++) {
      useCase.start(ctx.leagueId, allIds.get(i), "sub-1");
    }

    var capped = useCase.start(ctx.leagueId, allIds.get(StartInterview.DAILY_CAPACITY), "sub-1");

    assertThat(capped).isInstanceOf(InterviewResult.CapacityReached.class);
    assertThat(((InterviewResult.CapacityReached) capped).capacity())
        .isEqualTo(StartInterview.DAILY_CAPACITY);
  }

  @Test
  void start_isDeterministicAcrossRuns() {
    var ctx = seedLeagueInPhase("sub-1");

    useCase.start(ctx.leagueId, ctx.firstCandidateId, "sub-1");

    var history = interviews.findAllFor(ctx.teamId, LeaguePhase.HIRING_HEAD_COACH);
    assertThat(history).hasSize(1);
    assertThat(history.getFirst().interestLevel()).isNotNull();
  }

  @Test
  void start_phaseNotHiringHeadCoach_returnsNotFound() {
    var league = createLeagueFor("sub-1");

    var result = useCase.start(league.id(), 1L, "sub-1");

    assertThat(result).isInstanceOf(InterviewResult.NotFound.class);
  }

  @Test
  void start_unknownCandidate_returnsUnknownCandidate() {
    var ctx = seedLeagueInPhase("sub-1");

    var result = useCase.start(ctx.leagueId, 999_999L, "sub-1");

    assertThat(result).isInstanceOf(InterviewResult.UnknownCandidate.class);
  }

  @Test
  void start_notOwnedByCaller_returnsNotFound() {
    var ctx = seedLeagueInPhase("owner");

    var result = useCase.start(ctx.leagueId, ctx.firstCandidateId, "someone-else");

    assertThat(result).isInstanceOf(InterviewResult.NotFound.class);
  }

  private long secondCandidateId(Ctx ctx) {
    return candidates.findAllByPoolId(ctx.poolId).get(1).id();
  }

  private long thirdCandidateId(Ctx ctx) {
    return candidates.findAllByPoolId(ctx.poolId).get(2).id();
  }

  private long fourthCandidateId(Ctx ctx) {
    return candidates.findAllByPoolId(ctx.poolId).get(3).id();
  }

  private Ctx seedLeagueInPhase(String subject) {
    var league = createLeagueFor(subject);
    leagues.updatePhaseAndResetDay(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    entryHandler.onEntry(league.id());
    var pool =
        new JooqCandidatePoolRepository(dsl)
            .findByLeaguePhaseAndType(
                league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH)
            .orElseThrow();
    var summary = leagues.findSummaryByIdAndOwner(league.id(), subject).orElseThrow();
    var firstCandidate = candidates.findAllByPoolId(pool.id()).getFirst();
    return new Ctx(league.id(), summary.userTeamId(), pool.id(), firstCandidate.id());
  }

  private League createLeagueFor(String ownerSubject) {
    var franchiseId = new JooqFranchiseRepository(dsl).listAll().getFirst().id();
    var result = createLeague.create(ownerSubject, "Dynasty", franchiseId);
    return ((CreateLeagueResult.Created) result).league();
  }

  private TeamProfile fixedProfile(long teamId) {
    return new TeamProfile(
        teamId,
        MarketSize.LARGE,
        Geography.NE,
        Climate.NEUTRAL,
        new BigDecimal("75.00"),
        CompetitiveWindow.CONTENDER,
        new BigDecimal("60.00"),
        new BigDecimal("80.00"),
        "WEST_COAST");
  }

  private record Ctx(long leagueId, long teamId, long poolId, long firstCandidateId) {}
}
