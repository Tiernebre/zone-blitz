package app.zoneblitz.league.phase;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.CreateLeague;
import app.zoneblitz.league.CreateLeagueResult;
import app.zoneblitz.league.CreateLeagueUseCase;
import app.zoneblitz.league.FakeRandomSource;
import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.League;
import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.geography.Climate;
import app.zoneblitz.league.geography.Geography;
import app.zoneblitz.league.geography.MarketSize;
import app.zoneblitz.league.hiring.Candidate;
import app.zoneblitz.league.hiring.CandidateArchetype;
import app.zoneblitz.league.hiring.CandidateKind;
import app.zoneblitz.league.hiring.CandidateOffer;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.CandidateRandomSources;
import app.zoneblitz.league.hiring.CandidateTestData;
import app.zoneblitz.league.hiring.CompetitiveWindow;
import app.zoneblitz.league.hiring.JooqCandidateOfferRepository;
import app.zoneblitz.league.hiring.JooqCandidatePoolRepository;
import app.zoneblitz.league.hiring.JooqCandidatePreferencesRepository;
import app.zoneblitz.league.hiring.JooqCandidateRepository;
import app.zoneblitz.league.hiring.NewCandidate;
import app.zoneblitz.league.hiring.OfferStatus;
import app.zoneblitz.league.staff.JooqTeamStaffRepository;
import app.zoneblitz.league.staff.SpecialtyPosition;
import app.zoneblitz.league.staff.StaffRole;
import app.zoneblitz.league.staff.TeamStaffMember;
import app.zoneblitz.league.team.JooqTeamHiringStateRepository;
import app.zoneblitz.league.team.JooqTeamLookup;
import app.zoneblitz.league.team.JooqTeamRepository;
import app.zoneblitz.league.team.TeamHiringState;
import app.zoneblitz.league.team.TeamProfile;
import app.zoneblitz.league.team.TeamProfiles;
import app.zoneblitz.support.PostgresTestcontainer;
import java.math.BigDecimal;
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
class BestFitHiringAutofillTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private JooqCandidatePoolRepository pools;
  private JooqCandidateRepository candidates;
  private JooqCandidatePreferencesRepository preferences;
  private JooqCandidateOfferRepository offers;
  private JooqTeamHiringStateRepository hiringStates;
  private JooqTeamStaffRepository staff;
  private JooqTeamLookup teamLookup;
  private CreateLeague createLeague;
  private HiringPhaseAutofill autofill;
  private CandidateRandomSources rngs;
  private TeamProfiles teamProfiles;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    pools = new JooqCandidatePoolRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    preferences = new JooqCandidatePreferencesRepository(dsl);
    offers = new JooqCandidateOfferRepository(dsl);
    hiringStates = new JooqTeamHiringStateRepository(dsl);
    staff = new JooqTeamStaffRepository(dsl);
    teamLookup = new JooqTeamLookup(dsl);
    rngs = (leagueId, phase) -> new FakeRandomSource(leagueId + phase.ordinal());
    teamProfiles = teamId -> Optional.of(fixedProfile(teamId));
    createLeague = new CreateLeagueUseCase(leagues, franchises, teamRepo);
    autofill =
        new BestFitHiringAutofill(
            pools,
            candidates,
            preferences,
            offers,
            hiringStates,
            staff,
            teamLookup,
            teamProfiles,
            rngs);
  }

  @Test
  void autofill_whenPhaseHasNoPool_isNoOp() {
    var league = createLeagueFor("sub-1");

    autofill.autofill(league.id(), LeaguePhase.HIRING_HEAD_COACH, 3);

    assertThat(hiringStates.findAllForLeaguePhase(league.id(), LeaguePhase.HIRING_HEAD_COACH))
        .isEmpty();
  }

  @Test
  void autofill_assignsUnresolvedTeam_withBestFitCandidate() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    var pool =
        pools.insert(league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    insertCandidate(pool.id());
    insertCandidate(pool.id());
    // Fill out enough candidates so every team gets hired without running out.
    seedFillerCandidates(pool.id(), 20);

    var teamIds = teamLookup.teamIdsForLeague(league.id());
    var targetTeam = teamIds.getFirst();
    markSearching(league.id(), targetTeam, LeaguePhase.HIRING_HEAD_COACH);

    autofill.autofill(league.id(), LeaguePhase.HIRING_HEAD_COACH, 3);

    var state = hiringStates.find(targetTeam, LeaguePhase.HIRING_HEAD_COACH).orElseThrow();
    assertThat(state.step()).isEqualTo(HiringStep.HIRED);
    assertThat(staff.findAllForTeam(targetTeam))
        .extracting(TeamStaffMember::role)
        .containsExactly(StaffRole.HEAD_COACH);
    var hiredCandidateId = staff.findAllForTeam(targetTeam).getFirst().candidateId();
    assertThat(offers.findAllForCandidate(hiredCandidateId))
        .extracting(CandidateOffer::status)
        .containsExactly(OfferStatus.ACCEPTED);
  }

  @Test
  void autofill_skipsTeamsAlreadyHired() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    var pool =
        pools.insert(league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    insertCandidate(pool.id());
    seedFillerCandidates(pool.id(), 20);

    var teamIds = teamLookup.teamIdsForLeague(league.id());
    var alreadyHired = teamIds.get(0);
    var pending = teamIds.get(1);
    hiringStates.upsert(
        new TeamHiringState(
            0L,
            alreadyHired,
            LeaguePhase.HIRING_HEAD_COACH,
            HiringStep.HIRED,
            List.of(),
            List.of()));
    markSearching(league.id(), pending, LeaguePhase.HIRING_HEAD_COACH);

    autofill.autofill(league.id(), LeaguePhase.HIRING_HEAD_COACH, 3);

    assertThat(staff.findAllForTeam(alreadyHired)).isEmpty();
    assertThat(staff.findAllForTeam(pending))
        .extracting(TeamStaffMember::role)
        .containsExactly(StaffRole.HEAD_COACH);
  }

  @Test
  void autofill_multipleTeams_getDistinctCandidates() {
    var league = createLeagueFor("sub-1");
    leagues.updatePhaseAndResetWeek(league.id(), LeaguePhase.HIRING_HEAD_COACH);
    var pool =
        pools.insert(league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    insertCandidate(pool.id());
    insertCandidate(pool.id());
    seedFillerCandidates(pool.id(), 20);

    var teamIds = teamLookup.teamIdsForLeague(league.id());
    for (var teamId : teamIds) {
      markSearching(league.id(), teamId, LeaguePhase.HIRING_HEAD_COACH);
    }

    autofill.autofill(league.id(), LeaguePhase.HIRING_HEAD_COACH, 3);

    var hires =
        teamIds.stream()
            .map(staff::findAllForTeam)
            .flatMap(List::stream)
            .map(TeamStaffMember::candidateId)
            .toList();
    assertThat(hires).hasSize(teamIds.size()).doesNotHaveDuplicates();
  }

  private void seedFillerCandidates(long poolId, int count) {
    for (int i = 0; i < count; i++) {
      insertCandidate(poolId);
    }
  }

  private Candidate insertCandidate(long poolId) {
    var saved =
        candidates.insert(
            new NewCandidate(
                poolId,
                CandidateKind.HEAD_COACH,
                SpecialtyPosition.QB,
                CandidateArchetype.OFFENSIVE_PLAY_CALLER,
                "Marcus",
                "Hale",
                43,
                18,
                "{\"HC\":0}",
                "{\"overall\": 70.00}",
                Optional.empty()));
    preferences.insert(CandidateTestData.preferencesFor(saved.id()));
    return saved;
  }

  private void markSearching(long leagueId, long teamId, LeaguePhase phase) {
    hiringStates.upsert(
        new TeamHiringState(0L, teamId, phase, HiringStep.SEARCHING, List.of(), List.of()));
  }

  private League createLeagueFor(String ownerSubject) {
    var franchiseId = new JooqFranchiseRepository(dsl).listAll().getFirst().id();
    var result = createLeague.create(ownerSubject, "Dynasty-" + ownerSubject, franchiseId);
    return ((CreateLeagueResult.Created) result).league();
  }

  private TeamProfile fixedProfile(long teamId) {
    return new TeamProfile(
        teamId,
        MarketSize.LARGE,
        Geography.NE,
        Climate.NEUTRAL,
        new BigDecimal("75.00"),
        CompetitiveWindow.CONTENDER,
        new BigDecimal("60.00"),
        new BigDecimal("80.00"),
        "WEST_COAST");
  }
}
