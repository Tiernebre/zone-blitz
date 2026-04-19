package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.gamesimulator.rng.RandomSource;
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
  private FranchiseStaffRepository staffRepo;
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
    staffRepo = new JooqFranchiseStaffRepository(dsl);
    createLeague = new CreateLeagueUseCase(leagues, franchises, teamRepo);
    handler =
        new HiringAssemblingStaffTransitionHandler(
            teams,
            pools,
            candidates,
            preferences,
            staffRepo,
            new CoordinatorGenerator(),
            new PositionCoachGenerator(),
            new ScoutCandidateGenerator(),
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

    for (var franchiseId : teams.franchiseIdsForLeague(league.id())) {
      var hires = staffRepo.findAllForFranchise(league.id(), franchiseId);
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

    for (var franchiseId : teams.franchiseIdsForLeague(league.id())) {
      var roles =
          staffRepo.findAllForFranchise(league.id(), franchiseId).stream()
              .map(FranchiseStaffMember::role)
              .toList();
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

    var franchiseId = teams.franchiseIdsForLeague(league.id()).getFirst();
    var hires = staffRepo.findAllForFranchise(league.id(), franchiseId);

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

    var franchiseCount = teams.franchiseIdsForLeague(league.id()).size();
    assertThat(candidates.findAllByPoolId(coordinatorPool.id())).hasSize(franchiseCount * 3);
    assertThat(candidates.findAllByPoolId(positionCoachPool.id())).hasSize(franchiseCount * 9);
    assertThat(candidates.findAllByPoolId(scoutPool.id())).hasSize(franchiseCount * 8);

    assertThat(candidates.findAllByPoolId(coordinatorPool.id()))
        .allSatisfy(c -> assertThat(c.hiredByFranchiseId()).isPresent());
  }

  @Test
  void onEntry_isIdempotentPerFranchise() {
    var league = createLeagueFor("sub-1");
    seedHcAndDosForEveryFranchise(league.id());

    handler.onEntry(league.id());
    var firstFranchiseId = teams.franchiseIdsForLeague(league.id()).getFirst();
    var firstRunSize = staffRepo.findAllForFranchise(league.id(), firstFranchiseId).size();

    handler.onEntry(league.id());

    var secondRunSize = staffRepo.findAllForFranchise(league.id(), firstFranchiseId).size();
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
    for (var franchiseId : teams.franchiseIdsForLeague(leagueId)) {
      var hc = candidates.insert(CandidateTestData.newHeadCoach(hcPool.id()));
      preferences.insert(CandidateTestData.preferencesFor(hc.id()));
      candidates.markHired(hc.id(), franchiseId);
      staffRepo.insert(
          new NewFranchiseStaffMember(
              leagueId,
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
                  45,
                  15,
                  "{\"DOS\":2,\"SCOUT\":10}",
                  "{\"overall\": 70.0}",
                  "{\"overall\": 68.0}",
                  Optional.empty()));
      preferences.insert(CandidateTestData.preferencesFor(dos.id()));
      candidates.markHired(dos.id(), franchiseId);
      staffRepo.insert(
          new NewFranchiseStaffMember(
              leagueId,
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
