package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.support.PostgresTestcontainer;
import java.util.ArrayList;
import java.util.List;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

@JooqTest
@Import(PostgresTestcontainer.class)
class AdvancePhaseUseCaseTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private CreateLeague createLeague;
  private AdvancePhase advancePhase;
  private RecordingHandler initialSetupHandler;
  private RecordingHandler hiringHandler;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teams = new JooqTeamRepository(dsl);
    createLeague = new CreateLeagueUseCase(leagues, franchises, teams);
    initialSetupHandler = new RecordingHandler(LeaguePhase.INITIAL_SETUP);
    hiringHandler = new RecordingHandler(LeaguePhase.HIRING_HEAD_COACH);
    advancePhase = new AdvancePhaseUseCase(leagues, List.of(initialSetupHandler, hiringHandler));
  }

  @Test
  void advance_fromInitialSetup_transitionsToHiringHeadCoachAndResetsWeek() {
    var league = createLeagueFor("sub-1");
    leagues.incrementPhaseWeek(league.id());
    leagues.incrementPhaseWeek(league.id());

    var result = advancePhase.advance(league.id(), "sub-1");

    assertThat(result)
        .isEqualTo(
            new AdvancePhaseResult.Advanced(
                league.id(), LeaguePhase.INITIAL_SETUP, LeaguePhase.HIRING_HEAD_COACH));
    var after = leagues.findById(league.id()).orElseThrow();
    assertThat(after.phase()).isEqualTo(LeaguePhase.HIRING_HEAD_COACH);
    assertThat(after.phaseWeek()).isEqualTo(1);
  }

  @Test
  void advance_runsExitThenEntryHandlers() {
    var league = createLeagueFor("sub-1");

    advancePhase.advance(league.id(), "sub-1");

    assertThat(initialSetupHandler.exits).containsExactly(league.id());
    assertThat(initialSetupHandler.entries).isEmpty();
    assertThat(hiringHandler.exits).isEmpty();
    assertThat(hiringHandler.entries).containsExactly(league.id());
  }

  @Test
  void advance_whenLeagueMissing_returnsNotFound() {
    var result = advancePhase.advance(999_999L, "sub-1");

    assertThat(result).isEqualTo(new AdvancePhaseResult.NotFound(999_999L));
  }

  @Test
  void advance_whenNotOwnedByCaller_returnsNotFound() {
    var league = createLeagueFor("owner");

    var result = advancePhase.advance(league.id(), "someone-else");

    assertThat(result).isEqualTo(new AdvancePhaseResult.NotFound(league.id()));
  }

  @Test
  void advance_whenAlreadyInTerminalPhase_returnsNoNextPhase() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.ASSEMBLING_STAFF);

    var result = advancePhase.advance(league.id(), "sub-1");

    assertThat(result)
        .isEqualTo(new AdvancePhaseResult.NoNextPhase(league.id(), LeaguePhase.ASSEMBLING_STAFF));
    assertThat(leagues.findById(league.id()).orElseThrow().phase())
        .isEqualTo(LeaguePhase.ASSEMBLING_STAFF);
  }

  @Test
  void advance_fromHiringHeadCoach_transitionsToHiringDirectorOfScouting() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);

    var result = advancePhase.advance(league.id(), "sub-1");

    assertThat(result)
        .isEqualTo(
            new AdvancePhaseResult.Advanced(
                league.id(),
                LeaguePhase.HIRING_HEAD_COACH,
                LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING));
  }

  @Test
  void advance_fromHiringDirectorOfScouting_transitionsToAssemblingStaff() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING);

    var result = advancePhase.advance(league.id(), "sub-1");

    assertThat(result)
        .isEqualTo(
            new AdvancePhaseResult.Advanced(
                league.id(),
                LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING,
                LeaguePhase.ASSEMBLING_STAFF));
  }

  @Test
  void advance_worksWhenNoHandlersRegistered() {
    var advanceWithoutHandlers = new AdvancePhaseUseCase(leagues, List.of());
    var league = createLeagueFor("sub-1");

    var result = advanceWithoutHandlers.advance(league.id(), "sub-1");

    assertThat(result).isInstanceOf(AdvancePhaseResult.Advanced.class);
  }

  private League createLeagueFor(String ownerSubject) {
    var result = createLeague.create(ownerSubject, "Dynasty", firstFranchiseId());
    return ((CreateLeagueResult.Created) result).league();
  }

  private long firstFranchiseId() {
    return new JooqFranchiseRepository(dsl).listAll().getFirst().id();
  }

  private static final class RecordingHandler implements PhaseTransitionHandler {
    private final LeaguePhase phase;
    final List<Long> entries = new ArrayList<>();
    final List<Long> exits = new ArrayList<>();

    RecordingHandler(LeaguePhase phase) {
      this.phase = phase;
    }

    @Override
    public LeaguePhase phase() {
      return phase;
    }

    @Override
    public void onEntry(long leagueId) {
      entries.add(leagueId);
    }

    @Override
    public void onExit(long leagueId) {
      exits.add(leagueId);
    }
  }
}
