package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.support.PostgresTestcontainer;
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
  private CreateLeague createLeague;
  private AdvanceWeek advanceWeek;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teams = new JooqTeamRepository(dsl);
    createLeague = new CreateLeagueUseCase(leagues, franchises, teams);
    OfferResolver noopResolver = (leagueId, phase, week) -> {};
    advanceWeek =
        new AdvanceWeekUseCase(leagues, noopResolver, new JooqTeamLookup(dsl), java.util.List.of());
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
            leagues, capturingResolver, new JooqTeamLookup(dsl), java.util.List.of());

    useCase.advance(league.id(), "sub-1");

    assertThat(seen.get()).isEqualTo(1);
    assertThat(leagues.findById(league.id()).orElseThrow().phaseWeek()).isEqualTo(2);
  }

  @Test
  void advance_invokesCpuStrategy_onceForEachCpuFranchiseOfMatchingPhase() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    var calls = new java.util.ArrayList<Long>();
    CpuFranchiseStrategy cpu =
        new CpuFranchiseStrategy() {
          @Override
          public LeaguePhase phase() {
            return LeaguePhase.HIRING_HEAD_COACH;
          }

          @Override
          public void execute(long leagueId, long franchiseId, int phaseWeek) {
            calls.add(franchiseId);
          }
        };
    OfferResolver noopResolver = (leagueId, phase, week) -> {};
    var useCase =
        new AdvanceWeekUseCase(
            leagues, noopResolver, new JooqTeamLookup(dsl), java.util.List.of(cpu));

    useCase.advance(league.id(), "sub-1");

    var expectedCpuIds = new JooqTeamLookup(dsl).cpuFranchiseIdsForLeague(league.id());
    assertThat(calls).containsExactlyElementsOf(expectedCpuIds);
  }

  @Test
  void advance_doesNotInvokeCpuStrategy_whenPhaseDoesNotMatch() {
    var league = createLeagueFor("sub-1");
    var calls = new java.util.ArrayList<Long>();
    CpuFranchiseStrategy cpu =
        new CpuFranchiseStrategy() {
          @Override
          public LeaguePhase phase() {
            return LeaguePhase.HIRING_HEAD_COACH;
          }

          @Override
          public void execute(long leagueId, long franchiseId, int phaseWeek) {
            calls.add(franchiseId);
          }
        };
    OfferResolver noopResolver = (leagueId, phase, week) -> {};
    var useCase =
        new AdvanceWeekUseCase(
            leagues, noopResolver, new JooqTeamLookup(dsl), java.util.List.of(cpu));

    useCase.advance(league.id(), "sub-1");

    assertThat(calls).isEmpty();
  }

  @Test
  void advance_whenNotOwnedByCaller_returnsNotFound() {
    var league = createLeagueFor("owner");

    var result = advanceWeek.advance(league.id(), "someone-else");

    assertThat(result).isEqualTo(new AdvanceWeekResult.NotFound(league.id()));
  }

  private League createLeagueFor(String ownerSubject) {
    var result = createLeague.create(ownerSubject, "Dynasty", firstFranchiseId());
    return ((CreateLeagueResult.Created) result).league();
  }

  private long firstFranchiseId() {
    return new JooqFranchiseRepository(dsl).listAll().getFirst().id();
  }
}
