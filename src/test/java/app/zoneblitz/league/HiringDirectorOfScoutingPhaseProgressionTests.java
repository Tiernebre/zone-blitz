package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.support.PostgresTestcontainer;
import java.util.List;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

/**
 * End-to-end phase progression through HIRING_DIRECTOR_OF_SCOUTING. Verifies that after the DoS
 * pool is generated via {@link HiringDirectorOfScoutingTransitionHandler}, CPU franchises (and, via
 * autofill, any remaining unresolved franchises) progress through the phase and eventually advance
 * into {@link LeaguePhase#ASSEMBLING_STAFF}.
 */
@JooqTest
@Import(PostgresTestcontainer.class)
class HiringDirectorOfScoutingPhaseProgressionTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private CreateLeague createLeague;
  private AdvanceWeek advanceWeek;
  private AdvancePhase advancePhase;
  private TeamLookup teamLookup;
  private CandidatePoolRepository pools;
  private CandidateRepository candidates;
  private TeamHiringStateRepository hiringStates;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    teamLookup = new JooqTeamLookup(dsl);
    pools = new JooqCandidatePoolRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    var preferences = new JooqCandidatePreferencesRepository(dsl);
    var offers = new JooqCandidateOfferRepository(dsl);
    var staff = new JooqTeamStaffRepository(dsl);
    hiringStates = new JooqTeamHiringStateRepository(dsl);
    var interviews = new JooqTeamInterviewRepository(dsl);
    var profiles = new CityTeamProfiles(dsl, franchises);
    CandidateRandomSources rngs =
        (leagueId, phase) -> new FakeRandomSource(leagueId * 31 + phase.ordinal());

    createLeague = new CreateLeagueUseCase(leagues, franchises, teamRepo);

    var hcHandler =
        new HiringHeadCoachTransitionHandler(
            leagues,
            teamLookup,
            pools,
            candidates,
            preferences,
            hiringStates,
            new HeadCoachGenerator(),
            rngs);
    var dosHandler =
        new HiringDirectorOfScoutingTransitionHandler(
            leagues,
            teamLookup,
            pools,
            candidates,
            preferences,
            hiringStates,
            new DirectorOfScoutingGenerator(),
            rngs);

    advancePhase = new AdvancePhaseUseCase(leagues, List.of(hcHandler, dosHandler));

    var autofill =
        new BestScoutedHiringAutofill(
            pools, candidates, preferences, offers, hiringStates, staff, teamLookup, rngs);
    var resolver =
        new PreferenceScoringOfferResolver(
            offers, candidates, pools, preferences, profiles, hiringStates, staff, rngs);
    var hcCpu =
        new CpuHiringStrategy(
            LeaguePhase.HIRING_HEAD_COACH,
            CandidatePoolType.HEAD_COACH,
            pools,
            candidates,
            preferences,
            offers,
            hiringStates,
            interviews,
            rngs);
    var dosCpu =
        new CpuHiringStrategy(
            LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING,
            CandidatePoolType.DIRECTOR_OF_SCOUTING,
            pools,
            candidates,
            preferences,
            offers,
            hiringStates,
            interviews,
            rngs);

    advanceWeek =
        new AdvanceWeekUseCase(
            leagues,
            resolver,
            teamLookup,
            autofill,
            hiringStates,
            advancePhase,
            List.of(hcCpu, dosCpu));
  }

  @Test
  void fullHiringProgression_exitsHcThenEntersDosThenExitsDosIntoAssembling() {
    var league = createLeagueFor("sub-1");

    // Enter HC phase.
    advancePhase.advance(league.id(), "sub-1");
    assertThat(leagues.findById(league.id()).orElseThrow().phase())
        .isEqualTo(LeaguePhase.HIRING_HEAD_COACH);

    // Tick HC phase until it caps out; autofill + advance move us into DoS.
    tickUntilPhaseLeaves(league.id(), LeaguePhase.HIRING_HEAD_COACH, 10);

    assertThat(leagues.findById(league.id()).orElseThrow().phase())
        .isEqualTo(LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING);
    // DoS pool has been generated on phase entry.
    var dosPool =
        pools
            .findByLeaguePhaseAndType(
                league.id(),
                LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING,
                CandidatePoolType.DIRECTOR_OF_SCOUTING)
            .orElseThrow();
    assertThat(candidates.findAllByPoolId(dosPool.id())).isNotEmpty();

    // Tick DoS until it caps out and advances to ASSEMBLING_STAFF.
    tickUntilPhaseLeaves(league.id(), LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING, 10);

    assertThat(leagues.findById(league.id()).orElseThrow().phase())
        .isEqualTo(LeaguePhase.ASSEMBLING_STAFF);
    // Every franchise has a DoS hire recorded.
    var statesAfter =
        hiringStates.findAllForLeaguePhase(league.id(), LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING);
    assertThat(statesAfter).isNotEmpty();
    assertThat(statesAfter).allSatisfy(s -> assertThat(s.step()).isEqualTo(HiringStep.HIRED));
  }

  private void tickUntilPhaseLeaves(long leagueId, LeaguePhase phase, int maxTicks) {
    for (var i = 0; i < maxTicks; i++) {
      var current = leagues.findById(leagueId).orElseThrow().phase();
      if (current != phase) {
        return;
      }
      advanceWeek.advance(leagueId, "sub-1");
    }
  }

  private League createLeagueFor(String ownerSubject) {
    var franchiseId = new JooqFranchiseRepository(dsl).listAll().getFirst().id();
    var result = createLeague.create(ownerSubject, "Dynasty", franchiseId);
    return ((CreateLeagueResult.Created) result).league();
  }
}
