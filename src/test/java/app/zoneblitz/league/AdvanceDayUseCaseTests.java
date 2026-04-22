package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.hiring.CandidateRandomSources;
import app.zoneblitz.league.hiring.OfferResolver;
import app.zoneblitz.league.hiring.candidates.GenerateCandidatePoolUseCase;
import app.zoneblitz.league.hiring.candidates.JooqCandidatePoolRepository;
import app.zoneblitz.league.hiring.candidates.JooqCandidatePreferencesRepository;
import app.zoneblitz.league.hiring.candidates.JooqCandidateRepository;
import app.zoneblitz.league.hiring.generation.HeadCoachGenerator;
import app.zoneblitz.league.phase.AdvancePhase;
import app.zoneblitz.league.phase.AdvancePhaseResult;
import app.zoneblitz.league.phase.AdvancePhaseUseCase;
import app.zoneblitz.league.phase.HiringHeadCoachTransitionHandler;
import app.zoneblitz.league.phase.HiringPhaseAutofill;
import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.phase.LeaguePhases;
import app.zoneblitz.league.staff.JooqTeamStaffRepository;
import app.zoneblitz.league.team.CpuTeamStrategy;
import app.zoneblitz.league.team.JooqTeamHiringStateRepository;
import app.zoneblitz.league.team.JooqTeamLookup;
import app.zoneblitz.league.team.JooqTeamRepository;
import app.zoneblitz.league.team.TeamHiringState;
import app.zoneblitz.support.PostgresTestcontainer;
import java.util.List;
import java.util.Optional;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

@JooqTest
@Import(PostgresTestcontainer.class)
class AdvanceDayUseCaseTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private JooqTeamHiringStateRepository hiringStates;
  private JooqCandidatePoolRepository pools;
  private JooqCandidateRepository candidates;
  private JooqCandidatePreferencesRepository preferences;
  private JooqTeamStaffRepository staff;
  private JooqTeamLookup teamLookup;
  private CreateLeague createLeague;
  private AdvanceDay advanceDay;
  private HiringHeadCoachTransitionHandler hcEntryHandler;
  private AdvancePhase advancePhase;
  private HiringPhaseAutofill autofill;
  private CandidateRandomSources rngs;
  private OfferResolver noopResolver;
  private RecordingAutofill recordingAutofill;
  private RecordingAdvancePhase recordingAdvancePhase;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    hiringStates = new JooqTeamHiringStateRepository(dsl);
    pools = new JooqCandidatePoolRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    preferences = new JooqCandidatePreferencesRepository(dsl);
    staff = new JooqTeamStaffRepository(dsl);
    teamLookup = new JooqTeamLookup(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    createLeague = new CreateLeagueUseCase(leagues, franchises, teamRepo);
    rngs = (leagueId, phase) -> new FakeRandomSource(leagueId + phase.ordinal());
    var generatePool = new GenerateCandidatePoolUseCase(pools, candidates, preferences, rngs);
    hcEntryHandler =
        new HiringHeadCoachTransitionHandler(
            teamLookup,
            generatePool,
            hiringStates,
            new HeadCoachGenerator(app.zoneblitz.names.CuratedNameGenerator.maleDefaults()));
    autofill = (leagueId, phase, phaseDay) -> {};
    advancePhase = new AdvancePhaseUseCase(leagues, List.of());
    noopResolver = (leagueId, phase, week) -> {};
    recordingAutofill = new RecordingAutofill();
    recordingAdvancePhase = new RecordingAdvancePhase(leagues);
    advanceDay =
        new AdvanceDayUseCase(
            leagues, noopResolver, teamLookup, autofill, hiringStates, advancePhase, List.of());
  }

  @Test
  void advance_incrementsPhaseWeekAndReturnsTicked() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetDay(league.id(), LeaguePhase.HIRING_HEAD_COACH);

    var result = advanceDay.advance(league.id(), "sub-1");

    assertThat(result)
        .isEqualTo(
            new AdvanceDayResult.Ticked(
                league.id(), LeaguePhase.HIRING_HEAD_COACH, 2, Optional.empty()));
    assertThat(leagues.findById(league.id()).orElseThrow().phaseDay()).isEqualTo(2);
  }

  @Test
  void advance_repeatedTicks_keepIncrementing() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetDay(league.id(), LeaguePhase.HIRING_HEAD_COACH);

    advanceDay.advance(league.id(), "sub-1");
    var result = advanceDay.advance(league.id(), "sub-1");

    assertThat(((AdvanceDayResult.Ticked) result).phaseDay()).isEqualTo(3);
    assertThat(((AdvanceDayResult.Ticked) result).transitionedTo()).isEmpty();
  }

  @Test
  void advance_fromInitialSetup_transitionsToHeadCoachHiring() {
    var league = createLeagueFor("sub-1");

    var result = advanceDay.advance(league.id(), "sub-1");

    var ticked = (AdvanceDayResult.Ticked) result;
    assertThat(ticked.phase()).isEqualTo(LeaguePhase.HIRING_HEAD_COACH);
    assertThat(ticked.phaseDay()).isEqualTo(1);
    assertThat(ticked.transitionedTo()).contains(LeaguePhase.HIRING_HEAD_COACH);
  }

  @Test
  void advance_whenLeagueMissing_returnsNotFound() {
    var result = advanceDay.advance(999_999L, "sub-1");

    assertThat(result).isEqualTo(new AdvanceDayResult.NotFound(999_999L));
  }

  @Test
  void advance_invokesOfferResolverBeforeIncrementingWeek() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetDay(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    var seen = new java.util.concurrent.atomic.AtomicInteger(-1);
    OfferResolver capturingResolver = (leagueId, phase, dayAtResolve) -> seen.set(dayAtResolve);
    var useCase =
        new AdvanceDayUseCase(
            leagues,
            capturingResolver,
            teamLookup,
            autofill,
            hiringStates,
            advancePhase,
            List.of());

    useCase.advance(league.id(), "sub-1");

    assertThat(seen.get()).isEqualTo(1);
    assertThat(leagues.findById(league.id()).orElseThrow().phaseDay()).isEqualTo(2);
  }

  @Test
  void advance_invokesCpuStrategy_onceForEachCpuFranchiseOfMatchingPhase() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetDay(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    var calls = new java.util.ArrayList<Long>();
    CpuTeamStrategy cpu =
        new CpuTeamStrategy() {
          @Override
          public LeaguePhase phase() {
            return LeaguePhase.HIRING_HEAD_COACH;
          }

          @Override
          public void execute(long leagueId, long franchiseId, int phaseDay) {
            calls.add(franchiseId);
          }
        };
    var useCase =
        new AdvanceDayUseCase(
            leagues, noopResolver, teamLookup, autofill, hiringStates, advancePhase, List.of(cpu));

    useCase.advance(league.id(), "sub-1");

    var expectedCpuIds = teamLookup.cpuTeamIdsForLeague(league.id());
    assertThat(calls).containsExactlyElementsOf(expectedCpuIds);
  }

  @Test
  void advance_doesNotInvokeCpuStrategy_whenPhaseDoesNotMatch() {
    var league = createLeagueFor("sub-1");
    var calls = new java.util.ArrayList<Long>();
    CpuTeamStrategy cpu =
        new CpuTeamStrategy() {
          @Override
          public LeaguePhase phase() {
            return LeaguePhase.HIRING_HEAD_COACH;
          }

          @Override
          public void execute(long leagueId, long franchiseId, int phaseDay) {
            calls.add(franchiseId);
          }
        };
    var useCase =
        new AdvanceDayUseCase(
            leagues, noopResolver, teamLookup, autofill, hiringStates, advancePhase, List.of(cpu));

    useCase.advance(league.id(), "sub-1");

    assertThat(calls).isEmpty();
  }

  @Test
  void advance_whenNotOwnedByCaller_returnsNotFound() {
    var league = createLeagueFor("owner");

    var result = advanceDay.advance(league.id(), "someone-else");

    assertThat(result).isEqualTo(new AdvanceDayResult.NotFound(league.id()));
  }

  @Test
  void advance_whenAllFranchisesHired_transitionsToNextPhaseEarly() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetDay(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    markAllFranchisesHired(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    var useCase =
        new AdvanceDayUseCase(
            leagues,
            noopResolver,
            teamLookup,
            recordingAutofill,
            hiringStates,
            recordingAdvancePhase,
            List.of());

    var result = useCase.advance(league.id(), "sub-1");

    assertThat(recordingAdvancePhase.calls).isEqualTo(1);
    assertThat(recordingAutofill.calls).isEmpty();
    var ticked = (AdvanceDayResult.Ticked) result;
    assertThat(ticked.transitionedTo()).contains(LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING);
    assertThat(ticked.phase()).isEqualTo(LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING);
    assertThat(ticked.phaseDay()).isEqualTo(1);
  }

  @Test
  void advance_whenDayCapExceededWithPendingFranchise_runsAutofillAndTransitions() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetDay(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    hcEntryHandler.onEntry(league.id());
    // Burn days up to the cap so the next tick is the capped one.
    for (var i = 1; i < LeaguePhases.maxDays(LeaguePhase.HIRING_HEAD_COACH).orElseThrow(); i++) {
      leagues.incrementPhaseDay(league.id());
    }
    var useCase =
        new AdvanceDayUseCase(
            leagues,
            noopResolver,
            teamLookup,
            recordingAutofill,
            hiringStates,
            recordingAdvancePhase,
            List.of());

    var result = useCase.advance(league.id(), "sub-1");

    assertThat(recordingAutofill.calls)
        .containsExactly(
            new AutofillCall(
                league.id(),
                LeaguePhase.HIRING_HEAD_COACH,
                LeaguePhases.maxDays(LeaguePhase.HIRING_HEAD_COACH).orElseThrow()));
    assertThat(recordingAdvancePhase.calls).isEqualTo(1);
    var ticked = (AdvanceDayResult.Ticked) result;
    assertThat(ticked.transitionedTo()).contains(LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING);
  }

  @Test
  void advance_whenDayCapExceededWithAllHired_transitionsAndAutofillIsNoOp() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetDay(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    markAllFranchisesHired(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    for (var i = 1; i < LeaguePhases.maxDays(LeaguePhase.HIRING_HEAD_COACH).orElseThrow(); i++) {
      leagues.incrementPhaseDay(league.id());
    }
    var useCase =
        new AdvanceDayUseCase(
            leagues,
            noopResolver,
            teamLookup,
            autofill,
            hiringStates,
            recordingAdvancePhase,
            List.of());

    var result = useCase.advance(league.id(), "sub-1");

    // Cap triggers the autofill branch, but with every franchise already HIRED it is a no-op —
    // no new staff rows, no new offers. Transition still happens.
    for (var franchiseId : teamLookup.teamIdsForLeague(league.id())) {
      assertThat(staff.findAllForTeam(franchiseId)).isEmpty();
    }
    assertThat(recordingAdvancePhase.calls).isEqualTo(1);
    var ticked = (AdvanceDayResult.Ticked) result;
    assertThat(ticked.transitionedTo()).contains(LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING);
  }

  @Test
  void advance_whenBelowCapAndSomeFranchisesSearching_doesNotTransition() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetDay(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    // Only initialize a handful of SEARCHING states; leave others untouched.
    hiringStates.upsert(
        new TeamHiringState(
            0L,
            teamLookup.teamIdsForLeague(league.id()).getFirst(),
            LeaguePhase.HIRING_HEAD_COACH,
            HiringStep.SEARCHING,
            List.of()));
    var useCase =
        new AdvanceDayUseCase(
            leagues,
            noopResolver,
            teamLookup,
            recordingAutofill,
            hiringStates,
            recordingAdvancePhase,
            List.of());

    var result = useCase.advance(league.id(), "sub-1");

    assertThat(recordingAutofill.calls).isEmpty();
    assertThat(recordingAdvancePhase.calls).isZero();
    var ticked = (AdvanceDayResult.Ticked) result;
    assertThat(ticked.transitionedTo()).isEmpty();
    assertThat(ticked.phase()).isEqualTo(LeaguePhase.HIRING_HEAD_COACH);
    assertThat(ticked.phaseDay()).isEqualTo(2);
  }

  private void markAllFranchisesHired(long leagueId, LeaguePhase phase) {
    for (var franchiseId : teamLookup.teamIdsForLeague(leagueId)) {
      hiringStates.upsert(new TeamHiringState(0L, franchiseId, phase, HiringStep.HIRED, List.of()));
    }
  }

  private League createLeagueFor(String ownerSubject) {
    var result = createLeague.create(ownerSubject, "Dynasty", firstFranchiseId());
    return ((CreateLeagueResult.Created) result).league();
  }

  private long firstFranchiseId() {
    return new JooqFranchiseRepository(dsl).listAll().getFirst().id();
  }

  private record AutofillCall(long leagueId, LeaguePhase phase, int phaseDay) {}

  private static final class RecordingAutofill implements HiringPhaseAutofill {
    final List<AutofillCall> calls = new java.util.ArrayList<>();

    @Override
    public void autofill(long leagueId, LeaguePhase phase, int phaseDay) {
      calls.add(new AutofillCall(leagueId, phase, phaseDay));
    }
  }

  private static final class RecordingAdvancePhase implements AdvancePhase {
    private final LeagueRepository leagues;
    int calls;

    RecordingAdvancePhase(LeagueRepository leagues) {
      this.leagues = leagues;
    }

    @Override
    public AdvancePhaseResult advance(long leagueId, String ownerSubject) {
      calls++;
      var league = leagues.findSummaryByIdAndOwner(leagueId, ownerSubject).orElseThrow();
      var next = next(league.phase());
      leagues.updatePhaseAndResetDay(leagueId, next);
      return new AdvancePhaseResult.Advanced(leagueId, league.phase(), next);
    }

    private static LeaguePhase next(LeaguePhase phase) {
      return switch (phase) {
        case INITIAL_SETUP -> LeaguePhase.HIRING_HEAD_COACH;
        case HIRING_HEAD_COACH -> LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING;
        case HIRING_DIRECTOR_OF_SCOUTING -> LeaguePhase.ASSEMBLING_STAFF;
        case ASSEMBLING_STAFF -> LeaguePhase.EXPANSION_DRAFT_SCOUTING;
        case EXPANSION_DRAFT_SCOUTING -> LeaguePhase.COMPLETE;
        case COMPLETE -> LeaguePhase.COMPLETE;
      };
    }
  }
}
