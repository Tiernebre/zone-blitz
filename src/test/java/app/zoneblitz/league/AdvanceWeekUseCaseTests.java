package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;

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
class AdvanceWeekUseCaseTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private JooqTeamHiringStateRepository hiringStates;
  private JooqCandidatePoolRepository pools;
  private JooqCandidateRepository candidates;
  private JooqCandidatePreferencesRepository preferences;
  private JooqCandidateOfferRepository offers;
  private JooqTeamStaffRepository staff;
  private JooqTeamLookup teamLookup;
  private CreateLeague createLeague;
  private AdvanceWeek advanceWeek;
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
    offers = new JooqCandidateOfferRepository(dsl);
    staff = new JooqTeamStaffRepository(dsl);
    teamLookup = new JooqTeamLookup(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    createLeague = new CreateLeagueUseCase(leagues, franchises, teamRepo);
    rngs = (leagueId, phase) -> new FakeRandomSource(leagueId + phase.ordinal());
    hcEntryHandler =
        new HiringHeadCoachTransitionHandler(
            leagues,
            teamLookup,
            pools,
            candidates,
            preferences,
            hiringStates,
            new HeadCoachGenerator(),
            rngs);
    autofill =
        new BestScoutedHiringAutofill(
            pools, candidates, preferences, offers, hiringStates, staff, teamLookup, rngs);
    advancePhase = new AdvancePhaseUseCase(leagues, List.of());
    noopResolver = (leagueId, phase, week) -> {};
    recordingAutofill = new RecordingAutofill();
    recordingAdvancePhase = new RecordingAdvancePhase(leagues);
    advanceWeek =
        new AdvanceWeekUseCase(
            leagues, noopResolver, teamLookup, autofill, hiringStates, advancePhase, List.of());
  }

  @Test
  void advance_incrementsPhaseWeekAndReturnsTicked() {
    var league = createLeagueFor("sub-1");

    var result = advanceWeek.advance(league.id(), "sub-1");

    assertThat(result)
        .isEqualTo(
            new AdvanceWeekResult.Ticked(
                league.id(), LeaguePhase.INITIAL_SETUP, 2, Optional.empty()));
    assertThat(leagues.findById(league.id()).orElseThrow().phaseWeek()).isEqualTo(2);
  }

  @Test
  void advance_repeatedTicks_keepIncrementing() {
    var league = createLeagueFor("sub-1");

    advanceWeek.advance(league.id(), "sub-1");
    advanceWeek.advance(league.id(), "sub-1");
    var result = advanceWeek.advance(league.id(), "sub-1");

    assertThat(((AdvanceWeekResult.Ticked) result).phaseWeek()).isEqualTo(4);
  }

  @Test
  void advance_whenLeagueMissing_returnsNotFound() {
    var result = advanceWeek.advance(999_999L, "sub-1");

    assertThat(result).isEqualTo(new AdvanceWeekResult.NotFound(999_999L));
  }

  @Test
  void advance_invokesOfferResolverBeforeIncrementingWeek() {
    var league = createLeagueFor("sub-1");
    var seen = new java.util.concurrent.atomic.AtomicInteger(-1);
    OfferResolver capturingResolver = (leagueId, phase, weekAtResolve) -> seen.set(weekAtResolve);
    var useCase =
        new AdvanceWeekUseCase(
            leagues,
            capturingResolver,
            teamLookup,
            autofill,
            hiringStates,
            advancePhase,
            List.of());

    useCase.advance(league.id(), "sub-1");

    assertThat(seen.get()).isEqualTo(1);
    assertThat(leagues.findById(league.id()).orElseThrow().phaseWeek()).isEqualTo(2);
  }

  @Test
  void advance_invokesCpuStrategy_onceForEachCpuFranchiseOfMatchingPhase() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    var calls = new java.util.ArrayList<Long>();
    CpuTeamStrategy cpu =
        new CpuTeamStrategy() {
          @Override
          public LeaguePhase phase() {
            return LeaguePhase.HIRING_HEAD_COACH;
          }

          @Override
          public void execute(long leagueId, long franchiseId, int phaseWeek) {
            calls.add(franchiseId);
          }
        };
    var useCase =
        new AdvanceWeekUseCase(
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
          public void execute(long leagueId, long franchiseId, int phaseWeek) {
            calls.add(franchiseId);
          }
        };
    var useCase =
        new AdvanceWeekUseCase(
            leagues, noopResolver, teamLookup, autofill, hiringStates, advancePhase, List.of(cpu));

    useCase.advance(league.id(), "sub-1");

    assertThat(calls).isEmpty();
  }

  @Test
  void advance_whenNotOwnedByCaller_returnsNotFound() {
    var league = createLeagueFor("owner");

    var result = advanceWeek.advance(league.id(), "someone-else");

    assertThat(result).isEqualTo(new AdvanceWeekResult.NotFound(league.id()));
  }

  @Test
  void advance_whenAllFranchisesHired_transitionsToNextPhaseEarly() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    markAllFranchisesHired(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    var useCase =
        new AdvanceWeekUseCase(
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
    var ticked = (AdvanceWeekResult.Ticked) result;
    assertThat(ticked.transitionedTo()).contains(LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING);
    assertThat(ticked.phase()).isEqualTo(LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING);
    assertThat(ticked.phaseWeek()).isEqualTo(1);
  }

  @Test
  void advance_whenWeekCapExceededWithPendingFranchise_runsAutofillAndTransitions() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    hcEntryHandler.onEntry(league.id());
    // Burn weeks 1 and 2 so the third tick is the capped one.
    leagues.incrementPhaseWeek(league.id());
    leagues.incrementPhaseWeek(league.id());
    var useCase =
        new AdvanceWeekUseCase(
            leagues,
            noopResolver,
            teamLookup,
            recordingAutofill,
            hiringStates,
            recordingAdvancePhase,
            List.of());

    var result = useCase.advance(league.id(), "sub-1");

    assertThat(recordingAutofill.calls)
        .containsExactly(new AutofillCall(league.id(), LeaguePhase.HIRING_HEAD_COACH, 3));
    assertThat(recordingAdvancePhase.calls).isEqualTo(1);
    var ticked = (AdvanceWeekResult.Ticked) result;
    assertThat(ticked.transitionedTo()).contains(LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING);
  }

  @Test
  void advance_whenWeekCapExceededWithAllHired_transitionsAndAutofillIsNoOp() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    markAllFranchisesHired(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    leagues.incrementPhaseWeek(league.id());
    leagues.incrementPhaseWeek(league.id());
    var useCase =
        new AdvanceWeekUseCase(
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
    var ticked = (AdvanceWeekResult.Ticked) result;
    assertThat(ticked.transitionedTo()).contains(LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING);
  }

  @Test
  void advance_whenBelowCapAndSomeFranchisesSearching_doesNotTransition() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    // Only initialize a handful of SEARCHING states; leave others untouched.
    hiringStates.upsert(
        new TeamHiringState(
            0L,
            teamLookup.teamIdsForLeague(league.id()).getFirst(),
            LeaguePhase.HIRING_HEAD_COACH,
            HiringStep.SEARCHING,
            List.of(),
            List.of()));
    var useCase =
        new AdvanceWeekUseCase(
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
    var ticked = (AdvanceWeekResult.Ticked) result;
    assertThat(ticked.transitionedTo()).isEmpty();
    assertThat(ticked.phase()).isEqualTo(LeaguePhase.HIRING_HEAD_COACH);
    assertThat(ticked.phaseWeek()).isEqualTo(2);
  }

  private void markAllFranchisesHired(long leagueId, LeaguePhase phase) {
    for (var franchiseId : teamLookup.teamIdsForLeague(leagueId)) {
      hiringStates.upsert(
          new TeamHiringState(0L, franchiseId, phase, HiringStep.HIRED, List.of(), List.of()));
    }
  }

  private League createLeagueFor(String ownerSubject) {
    var result = createLeague.create(ownerSubject, "Dynasty", firstFranchiseId());
    return ((CreateLeagueResult.Created) result).league();
  }

  private long firstFranchiseId() {
    return new JooqFranchiseRepository(dsl).listAll().getFirst().id();
  }

  private record AutofillCall(long leagueId, LeaguePhase phase, int phaseWeek) {}

  private static final class RecordingAutofill implements HiringPhaseAutofill {
    final List<AutofillCall> calls = new java.util.ArrayList<>();

    @Override
    public void autofill(long leagueId, LeaguePhase phase, int phaseWeek) {
      calls.add(new AutofillCall(leagueId, phase, phaseWeek));
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
      leagues.updatePhaseAndResetWeek(leagueId, next);
      return new AdvancePhaseResult.Advanced(leagueId, league.phase(), next);
    }

    private static LeaguePhase next(LeaguePhase phase) {
      return switch (phase) {
        case INITIAL_SETUP -> LeaguePhase.HIRING_HEAD_COACH;
        case HIRING_HEAD_COACH -> LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING;
        case HIRING_DIRECTOR_OF_SCOUTING -> LeaguePhase.ASSEMBLING_STAFF;
        case ASSEMBLING_STAFF -> LeaguePhase.COMPLETE;
        case COMPLETE -> LeaguePhase.COMPLETE;
      };
    }
  }
}
