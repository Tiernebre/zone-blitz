package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.support.PostgresTestcontainer;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

@JooqTest
@Import(PostgresTestcontainer.class)
class HiringDirectorOfScoutingTransitionHandlerTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private CreateLeague createLeague;
  private CandidatePoolRepository pools;
  private CandidateRepository candidates;
  private CandidatePreferencesRepository preferences;
  private FranchiseHiringStateRepository hiringStates;
  private TeamLookup teams;
  private HiringDirectorOfScoutingTransitionHandler handler;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    teams = new JooqTeamLookup(dsl);
    pools = new JooqCandidatePoolRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    preferences = new JooqCandidatePreferencesRepository(dsl);
    hiringStates = new JooqFranchiseHiringStateRepository(dsl);
    createLeague = new CreateLeagueUseCase(leagues, franchises, teamRepo);
    handler =
        new HiringDirectorOfScoutingTransitionHandler(
            leagues,
            teams,
            pools,
            candidates,
            preferences,
            hiringStates,
            new DirectorOfScoutingGenerator(),
            new SeededRandomSources());
  }

  @Test
  void phase_isHiringDirectorOfScouting() {
    assertThat(handler.phase()).isEqualTo(LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING);
  }

  @Test
  void onEntry_generatesPoolCandidatesAndPreferencesAndInitialHiringStates() {
    var league = createLeagueFor("sub-1");

    handler.onEntry(league.id());

    var pool =
        pools
            .findByLeaguePhaseAndType(
                league.id(),
                LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING,
                CandidatePoolType.DIRECTOR_OF_SCOUTING)
            .orElseThrow();
    var generated = candidates.findAllByPoolId(pool.id());
    var franchiseCount = teams.franchiseIdsForLeague(league.id()).size();
    assertThat(generated).hasSize(franchiseCount * 3);
    assertThat(generated)
        .allSatisfy(c -> assertThat(c.kind()).isEqualTo(CandidateKind.DIRECTOR_OF_SCOUTING));
    assertThat(generated)
        .allSatisfy(c -> assertThat(preferences.findByCandidateId(c.id())).isPresent());

    var states =
        hiringStates.findAllForLeaguePhase(league.id(), LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING);
    assertThat(states).hasSize(franchiseCount);
    assertThat(states)
        .allSatisfy(
            s -> {
              assertThat(s.step()).isEqualTo(HiringStep.SEARCHING);
              assertThat(s.shortlist()).isEmpty();
              assertThat(s.interviewingCandidateIds()).isEmpty();
            });
  }

  @Test
  void onEntry_isIdempotent_whenPoolAlreadyExists() {
    var league = createLeagueFor("sub-1");
    handler.onEntry(league.id());
    var firstPool =
        pools
            .findByLeaguePhaseAndType(
                league.id(),
                LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING,
                CandidatePoolType.DIRECTOR_OF_SCOUTING)
            .orElseThrow();
    var firstCount = candidates.findAllByPoolId(firstPool.id()).size();

    handler.onEntry(league.id());

    var secondCount = candidates.findAllByPoolId(firstPool.id()).size();
    assertThat(secondCount).isEqualTo(firstCount);
  }

  private League createLeagueFor(String ownerSubject) {
    var franchiseId = new JooqFranchiseRepository(dsl).listAll().getFirst().id();
    var result = createLeague.create(ownerSubject, "Dynasty", franchiseId);
    return ((CreateLeagueResult.Created) result).league();
  }

  private static final class SeededRandomSources implements CandidateRandomSources {
    @Override
    public RandomSource forLeaguePhase(long leagueId, LeaguePhase phase) {
      return new FakeRandomSource(leagueId * 31 + phase.ordinal());
    }
  }
}
