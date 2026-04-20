package app.zoneblitz.league;

import static app.zoneblitz.jooq.Tables.TEAMS;
import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.franchise.FranchiseRepository;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.team.JooqTeamRepository;
import app.zoneblitz.support.PostgresTestcontainer;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

@JooqTest
@Import(PostgresTestcontainer.class)
class CreateLeagueUseCaseTests {

  @Autowired DSLContext dsl;

  private CreateLeague createLeague;
  private FranchiseRepository franchises;
  private LeagueRepository leagues;

  @BeforeEach
  void setUp() {
    franchises = new JooqFranchiseRepository(dsl);
    leagues = new JooqLeagueRepository(dsl);
    createLeague = new CreateLeagueUseCase(leagues, franchises, new JooqTeamRepository(dsl));
  }

  @Test
  void create_whenValid_createsLeagueWithInitialSetupPhaseAndDefaultSettings() {
    var franchiseId = franchises.listAll().getFirst().id();

    var result = createLeague.create("sub-1", "Dynasty", franchiseId);

    assertThat(result).isInstanceOf(CreateLeagueResult.Created.class);
    var league = ((CreateLeagueResult.Created) result).league();
    assertThat(league.name()).isEqualTo("Dynasty");
    assertThat(league.ownerSubject()).isEqualTo("sub-1");
    assertThat(league.phase()).isEqualTo(LeaguePhase.INITIAL_SETUP);
    assertThat(league.settings()).isEqualTo(LeagueSettings.defaults());
  }

  @Test
  void create_whenValid_materializesEightTeamsWithOneUserOwnedAndSevenCpu() {
    var franchiseId = franchises.listAll().getFirst().id();

    var result = createLeague.create("sub-1", "Dynasty", franchiseId);

    var leagueId = ((CreateLeagueResult.Created) result).league().id();
    var userTeams =
        dsl.fetchCount(TEAMS, TEAMS.LEAGUE_ID.eq(leagueId).and(TEAMS.OWNER_SUBJECT.eq("sub-1")));
    var cpuTeams =
        dsl.fetchCount(TEAMS, TEAMS.LEAGUE_ID.eq(leagueId).and(TEAMS.OWNER_SUBJECT.isNull()));
    assertThat(userTeams).isEqualTo(1);
    assertThat(cpuTeams).isEqualTo(7);
  }

  @Test
  void create_whenValid_seedsStaffBudgetCentsOnEveryTeam() {
    var franchiseId = franchises.listAll().getFirst().id();

    var result = createLeague.create("sub-1", "Dynasty", franchiseId);

    var leagueId = ((CreateLeagueResult.Created) result).league().id();
    var budgets =
        dsl.select(TEAMS.STAFF_BUDGET_CENTS)
            .from(TEAMS)
            .where(TEAMS.LEAGUE_ID.eq(leagueId))
            .fetch(TEAMS.STAFF_BUDGET_CENTS);
    assertThat(budgets).hasSize(8);
    assertThat(budgets).allMatch(b -> b == 2_500_000_000L);
  }

  @Test
  void create_trimsLeadingAndTrailingWhitespaceFromName() {
    var franchiseId = franchises.listAll().getFirst().id();

    var result = createLeague.create("sub-1", "  Dynasty  ", franchiseId);

    assertThat(((CreateLeagueResult.Created) result).league().name()).isEqualTo("Dynasty");
  }

  @Test
  void create_whenOwnerAlreadyHasLeagueWithSameNameCaseInsensitive_returnsNameTaken() {
    var ids = franchises.listAll();
    createLeague.create("sub-1", "Dynasty", ids.get(0).id());

    var result = createLeague.create("sub-1", "dynasty", ids.get(1).id());

    assertThat(result).isEqualTo(new CreateLeagueResult.NameTaken("dynasty"));
  }

  @Test
  void create_whenDifferentOwnerUsesSameName_succeeds() {
    var ids = franchises.listAll();
    createLeague.create("sub-a", "Dynasty", ids.get(0).id());

    var result = createLeague.create("sub-b", "Dynasty", ids.get(1).id());

    assertThat(result).isInstanceOf(CreateLeagueResult.Created.class);
  }

  @Test
  void create_whenFranchiseDoesNotExist_returnsUnknownFranchiseAndWritesNothing() {
    var before = dsl.fetchCount(app.zoneblitz.jooq.Tables.LEAGUES);

    var result = createLeague.create("sub-1", "Dynasty", 999_999L);

    assertThat(result).isEqualTo(new CreateLeagueResult.UnknownFranchise(999_999L));
    assertThat(dsl.fetchCount(app.zoneblitz.jooq.Tables.LEAGUES)).isEqualTo(before);
  }
}
