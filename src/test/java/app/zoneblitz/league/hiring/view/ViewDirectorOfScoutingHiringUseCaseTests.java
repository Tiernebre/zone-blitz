package app.zoneblitz.league.hiring.view;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.CreateLeague;
import app.zoneblitz.league.CreateLeagueResult;
import app.zoneblitz.league.CreateLeagueUseCase;
import app.zoneblitz.league.FakeRandomSource;
import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.League;
import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.hiring.candidates.JooqCandidatePoolRepository;
import app.zoneblitz.league.hiring.candidates.JooqCandidatePreferencesRepository;
import app.zoneblitz.league.hiring.candidates.JooqCandidateRepository;
import app.zoneblitz.league.hiring.generation.DirectorOfScoutingGenerator;
import app.zoneblitz.league.hiring.hire.JooqLeagueHires;
import app.zoneblitz.league.hiring.hire.JooqStaffBudgetRepository;
import app.zoneblitz.league.hiring.interview.JooqTeamInterviewRepository;
import app.zoneblitz.league.hiring.offer.JooqCandidateOfferRepository;
import app.zoneblitz.league.phase.HiringDirectorOfScoutingTransitionHandler;
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
class ViewDirectorOfScoutingHiringUseCaseTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private CreateLeague createLeague;
  private HiringDirectorOfScoutingTransitionHandler entryHandler;
  private ViewDirectorOfScoutingHiring useCase;

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
    app.zoneblitz.league.hiring.CandidateRandomSources rngs =
        (leagueId, phase) -> new FakeRandomSource(leagueId + phase.ordinal());
    var generatePool =
        new app.zoneblitz.league.hiring.candidates.GenerateCandidatePoolUseCase(
            pools, candidates, preferences, rngs);
    entryHandler =
        new HiringDirectorOfScoutingTransitionHandler(
            teams,
            generatePool,
            hiringStates,
            new DirectorOfScoutingGenerator(
                app.zoneblitz.names.CuratedNameGenerator.maleDefaults()));
    var interviews = new JooqTeamInterviewRepository(dsl);
    var offers = new JooqCandidateOfferRepository(dsl);
    var profiles = new app.zoneblitz.league.team.CityTeamProfiles(teams, franchises);
    var leagueHires = new JooqLeagueHires(dsl);
    var budgets = new JooqStaffBudgetRepository(dsl);
    useCase =
        new ViewDirectorOfScoutingHiringUseCase(
            leagues,
            pools,
            candidates,
            preferences,
            interviews,
            offers,
            profiles,
            leagueHires,
            budgets);
  }

  @Test
  void view_whenLeagueMissing_returnsEmpty() {
    assertThat(useCase.view(999_999L, "sub-1")).isEmpty();
  }

  @Test
  void view_whenNotOwnedByCaller_returnsEmpty() {
    var league = createLeagueFor("owner");
    leagues.updatePhaseAndResetDay(league.id(), LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING);
    entryHandler.onEntry(league.id());

    assertThat(useCase.view(league.id(), "someone-else")).isEmpty();
  }

  @Test
  void view_whenPhaseNotHiringDirectorOfScouting_returnsEmpty() {
    var league = createLeagueFor("sub-1");

    assertThat(useCase.view(league.id(), "sub-1")).isEmpty();
  }

  @Test
  void view_whenInPhase_returnsPoolAndNoOffers() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetDay(league.id(), LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING);
    entryHandler.onEntry(league.id());

    var view = useCase.view(league.id(), "sub-1").orElseThrow();

    assertThat(view.pool()).isNotEmpty();
    assertThat(view.activeInterviews()).isEmpty();
    assertThat(view.pool()).allSatisfy(row -> assertThat(row.hasOffer()).isFalse());
  }

  private League createLeagueFor(String ownerSubject) {
    var franchiseId = new JooqFranchiseRepository(dsl).listAll().getFirst().id();
    var result = createLeague.create(ownerSubject, "Dynasty", franchiseId);
    return ((CreateLeagueResult.Created) result).league();
  }
}
