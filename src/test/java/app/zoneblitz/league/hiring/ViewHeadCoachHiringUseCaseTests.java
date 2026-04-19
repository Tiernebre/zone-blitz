package app.zoneblitz.league.hiring;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.CreateLeague;
import app.zoneblitz.league.CreateLeagueResult;
import app.zoneblitz.league.CreateLeagueUseCase;
import app.zoneblitz.league.FakeRandomSource;
import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.League;
import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.phase.HiringHeadCoachTransitionHandler;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.team.JooqTeamHiringStateRepository;
import app.zoneblitz.league.team.JooqTeamLookup;
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
class ViewHeadCoachHiringUseCaseTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private CreateLeague createLeague;
  private HiringHeadCoachTransitionHandler entryHandler;
  private ViewHeadCoachHiring useCase;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    var teams = new JooqTeamLookup(dsl);
    var pools = new JooqCandidatePoolRepository(dsl);
    var candidates = new JooqCandidateRepository(dsl);
    var preferences = new JooqCandidatePreferencesRepository(dsl);
    var hiringStates = new JooqTeamHiringStateRepository(dsl);
    createLeague = new CreateLeagueUseCase(leagues, franchises, teamRepo);
    entryHandler =
        new HiringHeadCoachTransitionHandler(
            leagues,
            teams,
            pools,
            candidates,
            preferences,
            hiringStates,
            new HeadCoachGenerator(),
            (leagueId, phase) -> new FakeRandomSource(leagueId + phase.ordinal()));
    var interviews = new JooqTeamInterviewRepository(dsl);
    useCase =
        new ViewHeadCoachHiringUseCase(
            leagues, pools, candidates, preferences, hiringStates, interviews);
  }

  @Test
  void view_whenLeagueMissing_returnsEmpty() {
    assertThat(useCase.view(999_999L, "sub-1")).isEmpty();
  }

  @Test
  void view_whenNotOwnedByCaller_returnsEmpty() {
    var league = createLeagueFor("owner");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    entryHandler.onEntry(league.id());

    assertThat(useCase.view(league.id(), "someone-else")).isEmpty();
  }

  @Test
  void view_whenPhaseNotHiringHeadCoach_returnsEmpty() {
    var league = createLeagueFor("sub-1");

    assertThat(useCase.view(league.id(), "sub-1")).isEmpty();
  }

  @Test
  void view_whenInPhase_returnsPoolAndEmptyShortlist() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    entryHandler.onEntry(league.id());

    var view = useCase.view(league.id(), "sub-1").orElseThrow();

    assertThat(view.pool()).isNotEmpty();
    assertThat(view.shortlist()).isEmpty();
    assertThat(view.pool()).allSatisfy(row -> assertThat(row.shortlisted()).isFalse());
  }

  private League createLeagueFor(String ownerSubject) {
    var franchiseId = new JooqFranchiseRepository(dsl).listAll().getFirst().id();
    var result = createLeague.create(ownerSubject, "Dynasty", franchiseId);
    return ((CreateLeagueResult.Created) result).league();
  }
}
