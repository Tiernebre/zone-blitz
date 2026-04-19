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
    advanceWeek = new AdvanceWeekUseCase(leagues);
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
