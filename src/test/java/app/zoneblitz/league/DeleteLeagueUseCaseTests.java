package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.support.PostgresTestcontainer;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

@JooqTest
@Import(PostgresTestcontainer.class)
class DeleteLeagueUseCaseTests {

  @Autowired DSLContext dsl;

  private CreateLeague createLeague;
  private DeleteLeague deleteLeague;
  private LeagueRepository leagues;
  private FranchiseRepository franchises;

  @BeforeEach
  void setUp() {
    franchises = new JooqFranchiseRepository(dsl);
    leagues = new JooqLeagueRepository(dsl);
    var teams = new JooqTeamRepository(dsl);
    createLeague = new CreateLeagueUseCase(leagues, franchises, teams);
    deleteLeague = new DeleteLeagueUseCase(leagues);
  }

  @Test
  void delete_whenOwned_returnsDeletedAndRemovesLeague() {
    var franchiseId = franchises.listAll().getFirst().id();
    var league =
        ((CreateLeagueResult.Created) createLeague.create("sub-1", "Dynasty", franchiseId))
            .league();

    var result = deleteLeague.delete(league.id(), "sub-1");

    assertThat(result).isEqualTo(new DeleteLeagueResult.Deleted(league.id()));
    assertThat(leagues.findSummaryByIdAndOwner(league.id(), "sub-1")).isEmpty();
  }

  @Test
  void delete_whenNotOwned_returnsNotFoundAndLeavesLeagueIntact() {
    var franchiseId = franchises.listAll().getFirst().id();
    var league =
        ((CreateLeagueResult.Created) createLeague.create("owner", "Dynasty", franchiseId))
            .league();

    var result = deleteLeague.delete(league.id(), "someone-else");

    assertThat(result).isEqualTo(new DeleteLeagueResult.NotFound(league.id()));
    assertThat(leagues.findSummaryByIdAndOwner(league.id(), "owner")).isPresent();
  }

  @Test
  void delete_whenMissing_returnsNotFound() {
    var result = deleteLeague.delete(999_999L, "sub-1");

    assertThat(result).isEqualTo(new DeleteLeagueResult.NotFound(999_999L));
  }
}
