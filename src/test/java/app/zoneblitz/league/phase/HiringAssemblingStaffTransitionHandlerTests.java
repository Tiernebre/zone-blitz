package app.zoneblitz.league.phase;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.league.CreateLeague;
import app.zoneblitz.league.CreateLeagueResult;
import app.zoneblitz.league.CreateLeagueUseCase;
import app.zoneblitz.league.FakeRandomSource;
import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.League;
import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.hiring.CandidateArchetype;
import app.zoneblitz.league.hiring.CandidateKind;
import app.zoneblitz.league.hiring.CandidatePoolRepository;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.CandidatePreferencesRepository;
import app.zoneblitz.league.hiring.CandidateRandomSources;
import app.zoneblitz.league.hiring.CandidateRepository;
import app.zoneblitz.league.hiring.CandidateTestData;
import app.zoneblitz.league.hiring.CoordinatorGenerator;
import app.zoneblitz.league.hiring.JooqCandidatePoolRepository;
import app.zoneblitz.league.hiring.JooqCandidatePreferencesRepository;
import app.zoneblitz.league.hiring.JooqCandidateRepository;
import app.zoneblitz.league.hiring.NewCandidate;
import app.zoneblitz.league.hiring.PositionCoachGenerator;
import app.zoneblitz.league.hiring.ScoutBranch;
import app.zoneblitz.league.hiring.ScoutCandidateGenerator;
import app.zoneblitz.league.staff.JooqTeamStaffRepository;
import app.zoneblitz.league.staff.NewTeamStaffMember;
import app.zoneblitz.league.staff.SpecialtyPosition;
import app.zoneblitz.league.staff.StaffRole;
import app.zoneblitz.league.staff.TeamStaffMember;
import app.zoneblitz.league.staff.TeamStaffRepository;
import app.zoneblitz.league.team.JooqTeamLookup;
import app.zoneblitz.league.team.JooqTeamRepository;
import app.zoneblitz.league.team.TeamLookup;
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
class HiringAssemblingStaffTransitionHandlerTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private CreateLeague createLeague;
  private CandidatePoolRepository pools;
  private CandidateRepository candidates;
  private CandidatePreferencesRepository preferences;
  private TeamStaffRepository staffRepo;
  private TeamLookup teams;
  private HiringAssemblingStaffTransitionHandler handler;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    teams = new JooqTeamLookup(dsl);
    pools = new JooqCandidatePoolRepository(dsl);
    candidates = new JooqCandidateRepository(dsl);
    preferences = new JooqCandidatePreferencesRepository(dsl);
    staffRepo = new JooqTeamStaffRepository(dsl);
    createLeague = new CreateLeagueUseCase(leagues, franchises, teamRepo);
    handler =
        new HiringAssemblingStaffTransitionHandler(
            teams,
            pools,
            candidates,
            preferences,
            staffRepo,
            new CoordinatorGenerator(app.zoneblitz.names.CuratedNameGenerator.maleDefaults()),
            new PositionCoachGenerator(app.zoneblitz.names.CuratedNameGenerator.maleDefaults()),
            new ScoutCandidateGenerator(app.zoneblitz.names.CuratedNameGenerator.maleDefaults()),
            new SeededRandomSources());
  }

  @Test
  void phase_isAssemblingStaff() {
    assertThat(handler.phase()).isEqualTo(LeaguePhase.ASSEMBLING_STAFF);
  }

  @Test
  void onEntry_everyFranchiseHasTwelveCoachesAndEightScouts() {
    var league = createLeagueFor("sub-1");
    seedHcAndDosForEveryFranchise(league.id());

    handler.onEntry(league.id());

    for (var franchiseId : teams.teamIdsForLeague(league.id())) {
      var hires = staffRepo.findAllForTeam(franchiseId);
      var coachCount =
          hires.stream()
              .filter(
                  h ->
                      h.role() != StaffRole.COLLEGE_SCOUT
                          && h.role() != StaffRole.PRO_SCOUT
                          && h.role() != StaffRole.DIRECTOR_OF_SCOUTING)
              .count();
      var scoutCount =
          hires.stream()
              .filter(h -> h.role() == StaffRole.COLLEGE_SCOUT || h.role() == StaffRole.PRO_SCOUT)
              .count();
      // coaches: HC (already seeded) + 12 subordinates = 13
      assertThat(coachCount).as("franchise %s coaches", franchiseId).isEqualTo(13L);
      assertThat(scoutCount).as("franchise %s scouts", franchiseId).isEqualTo(8L);
    }
  }

  @Test
  void onEntry_coversEveryNonScoutRole() {
    var league = createLeagueFor("sub-1");
    seedHcAndDosForEveryFranchise(league.id());

    handler.onEntry(league.id());

    for (var franchiseId : teams.teamIdsForLeague(league.id())) {
      var roles =
          staffRepo.findAllForTeam(franchiseId).stream().map(TeamStaffMember::role).toList();
      assertThat(roles)
          .contains(
              StaffRole.HEAD_COACH,
              StaffRole.OFFENSIVE_COORDINATOR,
              StaffRole.DEFENSIVE_COORDINATOR,
              StaffRole.SPECIAL_TEAMS_COORDINATOR,
              StaffRole.QB_COACH,
              StaffRole.RB_COACH,
              StaffRole.WR_COACH,
              StaffRole.TE_COACH,
              StaffRole.OL_COACH,
              StaffRole.DL_COACH,
              StaffRole.EDGE_COACH,
              StaffRole.LB_COACH,
              StaffRole.DB_COACH,
              StaffRole.DIRECTOR_OF_SCOUTING);
    }
  }

  @Test
  void onEntry_scoutBranchIsSetForScoutsAndUnsetForCoaches() {
    var league = createLeagueFor("sub-1");
    seedHcAndDosForEveryFranchise(league.id());

    handler.onEntry(league.id());

    var franchiseId = teams.teamIdsForLeague(league.id()).getFirst();
    var hires = staffRepo.findAllForTeam(franchiseId);

    var collegeScouts = hires.stream().filter(h -> h.role() == StaffRole.COLLEGE_SCOUT).toList();
    var proScouts = hires.stream().filter(h -> h.role() == StaffRole.PRO_SCOUT).toList();
    assertThat(collegeScouts).hasSize(5);
    assertThat(proScouts).hasSize(3);
    assertThat(collegeScouts)
        .allSatisfy(h -> assertThat(h.scoutBranch()).hasValue(ScoutBranch.COLLEGE));
    assertThat(proScouts).allSatisfy(h -> assertThat(h.scoutBranch()).hasValue(ScoutBranch.PRO));
    assertThat(
            hires.stream()
                .filter(
                    h -> h.role() != StaffRole.COLLEGE_SCOUT && h.role() != StaffRole.PRO_SCOUT))
        .allSatisfy(h -> assertThat(h.scoutBranch()).isEmpty());
  }

  @Test
  void onEntry_candidatesAreMarkedHiredAndInCorrectPools() {
    var league = createLeagueFor("sub-1");
    seedHcAndDosForEveryFranchise(league.id());

    handler.onEntry(league.id());

    var coordinatorPool =
        pools
            .findByLeaguePhaseAndType(
                league.id(), LeaguePhase.ASSEMBLING_STAFF, CandidatePoolType.COORDINATOR)
            .orElseThrow();
    var positionCoachPool =
        pools
            .findByLeaguePhaseAndType(
                league.id(), LeaguePhase.ASSEMBLING_STAFF, CandidatePoolType.POSITION_COACH)
            .orElseThrow();
    var scoutPool =
        pools
            .findByLeaguePhaseAndType(
                league.id(), LeaguePhase.ASSEMBLING_STAFF, CandidatePoolType.SCOUT)
            .orElseThrow();

    var franchiseCount = teams.teamIdsForLeague(league.id()).size();
    assertThat(candidates.findAllByPoolId(coordinatorPool.id())).hasSize(franchiseCount * 3);
    assertThat(candidates.findAllByPoolId(positionCoachPool.id())).hasSize(franchiseCount * 9);
    assertThat(candidates.findAllByPoolId(scoutPool.id())).hasSize(franchiseCount * 8);

    assertThat(candidates.findAllByPoolId(coordinatorPool.id()))
        .allSatisfy(c -> assertThat(c.hiredByTeamId()).isPresent());
  }

  @Test
  void onEntry_isIdempotentPerFranchise() {
    var league = createLeagueFor("sub-1");
    seedHcAndDosForEveryFranchise(league.id());

    handler.onEntry(league.id());
    var firstFranchiseId = teams.teamIdsForLeague(league.id()).getFirst();
    var firstRunSize = staffRepo.findAllForTeam(firstFranchiseId).size();

    handler.onEntry(league.id());

    var secondRunSize = staffRepo.findAllForTeam(firstFranchiseId).size();
    assertThat(secondRunSize).isEqualTo(firstRunSize);
  }

  private League createLeagueFor(String ownerSubject) {
    var franchiseId = new JooqFranchiseRepository(dsl).listAll().getFirst().id();
    var result = createLeague.create(ownerSubject, "Dynasty", franchiseId);
    return ((CreateLeagueResult.Created) result).league();
  }

  private void seedHcAndDosForEveryFranchise(long leagueId) {
    var hcPool =
        pools.insert(leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    var dosPool =
        pools.insert(
            leagueId,
            LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING,
            CandidatePoolType.DIRECTOR_OF_SCOUTING);
    for (var franchiseId : teams.teamIdsForLeague(leagueId)) {
      var hc = candidates.insert(CandidateTestData.newHeadCoach(hcPool.id()));
      preferences.insert(CandidateTestData.preferencesFor(hc.id()));
      candidates.markHired(hc.id(), franchiseId);
      staffRepo.insert(
          new NewTeamStaffMember(
              franchiseId,
              hc.id(),
              StaffRole.HEAD_COACH,
              Optional.empty(),
              LeaguePhase.HIRING_HEAD_COACH,
              1));
      var dos =
          candidates.insert(
              new NewCandidate(
                  dosPool.id(),
                  CandidateKind.DIRECTOR_OF_SCOUTING,
                  SpecialtyPosition.CB,
                  CandidateArchetype.GENERALIST,
                  "Jordan",
                  "Okafor",
                  45,
                  15,
                  "{\"DOS\":2,\"SCOUT\":10}",
                  "{\"overall\": 70.0}",
                  Optional.empty()));
      preferences.insert(CandidateTestData.preferencesFor(dos.id()));
      candidates.markHired(dos.id(), franchiseId);
      staffRepo.insert(
          new NewTeamStaffMember(
              franchiseId,
              dos.id(),
              StaffRole.DIRECTOR_OF_SCOUTING,
              Optional.empty(),
              LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING,
              1));
    }
  }

  private static final class SeededRandomSources implements CandidateRandomSources {
    @Override
    public RandomSource forLeaguePhase(long leagueId, LeaguePhase phase) {
      return new FakeRandomSource(leagueId * 131 + phase.ordinal());
    }
  }
}
