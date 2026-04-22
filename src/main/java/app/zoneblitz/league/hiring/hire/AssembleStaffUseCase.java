package app.zoneblitz.league.hiring.hire;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.league.hiring.AssembleStaff;
import app.zoneblitz.league.hiring.Candidate;
import app.zoneblitz.league.hiring.CandidateArchetype;
import app.zoneblitz.league.hiring.CandidateKind;
import app.zoneblitz.league.hiring.CandidatePool;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.CandidateRandomSources;
import app.zoneblitz.league.hiring.CoordinatorCandidateGenerator;
import app.zoneblitz.league.hiring.GeneratedCandidate;
import app.zoneblitz.league.hiring.NewCandidate;
import app.zoneblitz.league.hiring.PositionCoachCandidateGenerator;
import app.zoneblitz.league.hiring.ScoutBranch;
import app.zoneblitz.league.hiring.ScoutCandidatePoolGenerator;
import app.zoneblitz.league.hiring.candidates.CandidatePoolRepository;
import app.zoneblitz.league.hiring.candidates.CandidatePreferencesRepository;
import app.zoneblitz.league.hiring.candidates.CandidateRepository;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.staff.NewTeamStaffMember;
import app.zoneblitz.league.staff.SpecialtyPosition;
import app.zoneblitz.league.staff.StaffRole;
import app.zoneblitz.league.staff.TeamStaffRepository;
import app.zoneblitz.league.team.TeamLookup;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AssembleStaffUseCase implements AssembleStaff {

  private static final Logger log = LoggerFactory.getLogger(AssembleStaffUseCase.class);

  private static final LeaguePhase PHASE = LeaguePhase.ASSEMBLING_STAFF;

  private static final List<SpecialtyPosition> POSITION_COACH_SPECIALTIES =
      List.of(
          SpecialtyPosition.QB,
          SpecialtyPosition.RB,
          SpecialtyPosition.WR,
          SpecialtyPosition.TE,
          SpecialtyPosition.OL,
          SpecialtyPosition.DL,
          SpecialtyPosition.EDGE,
          SpecialtyPosition.LB,
          SpecialtyPosition.CB);

  private static final int COLLEGE_SCOUTS = 5;
  private static final int PRO_SCOUTS = 3;
  private static final int GENERATION_OVERSAMPLE = 3;

  private final TeamLookup teams;
  private final CandidatePoolRepository pools;
  private final CandidateRepository candidates;
  private final CandidatePreferencesRepository preferences;
  private final TeamStaffRepository staff;
  private final CoordinatorCandidateGenerator coordinatorGenerator;
  private final PositionCoachCandidateGenerator positionCoachGenerator;
  private final ScoutCandidatePoolGenerator scoutGenerator;
  private final CandidateRandomSources rngs;

  public AssembleStaffUseCase(
      TeamLookup teams,
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      TeamStaffRepository staff,
      CoordinatorCandidateGenerator coordinatorGenerator,
      PositionCoachCandidateGenerator positionCoachGenerator,
      ScoutCandidatePoolGenerator scoutGenerator,
      CandidateRandomSources rngs) {
    this.teams = Objects.requireNonNull(teams, "teams");
    this.pools = Objects.requireNonNull(pools, "pools");
    this.candidates = Objects.requireNonNull(candidates, "candidates");
    this.preferences = Objects.requireNonNull(preferences, "preferences");
    this.staff = Objects.requireNonNull(staff, "staff");
    this.coordinatorGenerator =
        Objects.requireNonNull(coordinatorGenerator, "coordinatorGenerator");
    this.positionCoachGenerator =
        Objects.requireNonNull(positionCoachGenerator, "positionCoachGenerator");
    this.scoutGenerator = Objects.requireNonNull(scoutGenerator, "scoutGenerator");
    this.rngs = Objects.requireNonNull(rngs, "rngs");
  }

  @Override
  public void assemble(long leagueId) {
    var teamIds = teams.teamIdsForLeague(leagueId);
    if (teamIds.isEmpty()) {
      log.debug("no teams for league={}, assembling-staff is a no-op", leagueId);
      return;
    }
    var coordinatorPool = findOrCreatePool(leagueId, CandidatePoolType.COORDINATOR);
    var positionCoachPool = findOrCreatePool(leagueId, CandidatePoolType.POSITION_COACH);
    var scoutPool = findOrCreatePool(leagueId, CandidatePoolType.SCOUT);

    var rng = rngs.forLeaguePhase(leagueId, PHASE);
    var assembledCount = 0;
    for (var teamId : teamIds) {
      if (alreadyAssembled(teamId)) {
        log.debug(
            "team already has subordinate staff leagueId={} teamId={}; skipping", leagueId, teamId);
        continue;
      }
      assembleFor(teamId, coordinatorPool.id(), positionCoachPool.id(), scoutPool.id(), rng);
      assembledCount++;
    }
    log.info(
        "assembling-staff completed leagueId={} teamsAssembled={}/{}",
        leagueId,
        assembledCount,
        teamIds.size());
  }

  private CandidatePool findOrCreatePool(long leagueId, CandidatePoolType type) {
    return pools
        .findByLeaguePhaseAndType(leagueId, PHASE, type)
        .orElseGet(() -> pools.insert(leagueId, PHASE, type));
  }

  private boolean alreadyAssembled(long teamId) {
    return staff.findAllForTeam(teamId).stream()
        .anyMatch(
            s -> s.role() != StaffRole.HEAD_COACH && s.role() != StaffRole.DIRECTOR_OF_SCOUTING);
  }

  private void assembleFor(
      long teamId,
      long coordinatorPoolId,
      long positionCoachPoolId,
      long scoutPoolId,
      RandomSource rng) {
    var hc = findHired(teamId, StaffRole.HEAD_COACH);
    var dos = findHired(teamId, StaffRole.DIRECTOR_OF_SCOUTING);

    hireCoordinator(
        teamId,
        coordinatorPoolId,
        StaffRole.OFFENSIVE_COORDINATOR,
        CandidateKind.OFFENSIVE_COORDINATOR,
        hc,
        rng);
    hireCoordinator(
        teamId,
        coordinatorPoolId,
        StaffRole.DEFENSIVE_COORDINATOR,
        CandidateKind.DEFENSIVE_COORDINATOR,
        hc,
        rng);
    hireCoordinator(
        teamId,
        coordinatorPoolId,
        StaffRole.SPECIAL_TEAMS_COORDINATOR,
        CandidateKind.SPECIAL_TEAMS_COORDINATOR,
        hc,
        rng);

    for (var specialty : POSITION_COACH_SPECIALTIES) {
      hirePositionCoach(teamId, positionCoachPoolId, specialty, hc, rng);
    }

    for (var i = 0; i < COLLEGE_SCOUTS; i++) {
      hireScout(teamId, scoutPoolId, ScoutBranch.COLLEGE, dos, rng);
    }
    for (var i = 0; i < PRO_SCOUTS; i++) {
      hireScout(teamId, scoutPoolId, ScoutBranch.PRO, dos, rng);
    }
  }

  private Optional<Candidate> findHired(long teamId, StaffRole role) {
    return staff.findAllForTeam(teamId).stream()
        .filter(s -> s.role() == role)
        .findFirst()
        .flatMap(s -> candidates.findById(s.candidateId()));
  }

  private void hireCoordinator(
      long teamId,
      long poolId,
      StaffRole role,
      CandidateKind kind,
      Optional<Candidate> hc,
      RandomSource rng) {
    var generated = coordinatorGenerator.generate(GENERATION_OVERSAMPLE, kind, rng);
    var pick = pickBiased(generated, c -> coordinatorBias(c, kind, hc));
    persistAndHire(teamId, poolId, pick, role, Optional.empty());
  }

  private void hirePositionCoach(
      long teamId,
      long poolId,
      SpecialtyPosition specialty,
      Optional<Candidate> hc,
      RandomSource rng) {
    var generated = positionCoachGenerator.generate(GENERATION_OVERSAMPLE, specialty, rng);
    var pick = pickBiased(generated, c -> positionCoachBias(c, specialty, hc));
    persistAndHire(teamId, poolId, pick, positionCoachRoleFor(specialty), Optional.empty());
  }

  private void hireScout(
      long teamId, long poolId, ScoutBranch branch, Optional<Candidate> dos, RandomSource rng) {
    var generated = scoutGenerator.generate(GENERATION_OVERSAMPLE, branch, rng);
    var pick = pickBiased(generated, c -> scoutBias(c, branch, dos));
    var role = branch == ScoutBranch.COLLEGE ? StaffRole.COLLEGE_SCOUT : StaffRole.PRO_SCOUT;
    persistAndHire(teamId, poolId, pick, role, Optional.of(branch));
  }

  private static StaffRole positionCoachRoleFor(SpecialtyPosition specialty) {
    return switch (specialty) {
      case QB -> StaffRole.QB_COACH;
      case RB, FB -> StaffRole.RB_COACH;
      case WR -> StaffRole.WR_COACH;
      case TE -> StaffRole.TE_COACH;
      case OL -> StaffRole.OL_COACH;
      case DL -> StaffRole.DL_COACH;
      case EDGE -> StaffRole.EDGE_COACH;
      case LB -> StaffRole.LB_COACH;
      case CB, S -> StaffRole.DB_COACH;
      case K, P, LS ->
          throw new IllegalStateException(
              "special teams specialty used as position-coach role: " + specialty);
    };
  }

  private GeneratedCandidate pickBiased(
      List<GeneratedCandidate> generated,
      java.util.function.ToDoubleFunction<GeneratedCandidate> bias) {
    var ranked = new ArrayList<>(generated);
    ranked.sort(Comparator.<GeneratedCandidate>comparingDouble(bias::applyAsDouble).reversed());
    return ranked.getFirst();
  }

  private double coordinatorBias(GeneratedCandidate g, CandidateKind kind, Optional<Candidate> hc) {
    if (hc.isEmpty()) {
      return 0.0;
    }
    var hcArchetype = hc.get().archetype();
    var coordArchetype = g.candidate().archetype();
    if (kind == CandidateKind.OFFENSIVE_COORDINATOR
        && (hcArchetype == CandidateArchetype.OFFENSIVE_PLAY_CALLER
            || hcArchetype == CandidateArchetype.OFFENSIVE_GURU)
        && (coordArchetype == CandidateArchetype.OFFENSIVE_PLAY_CALLER
            || coordArchetype == CandidateArchetype.OFFENSIVE_GURU)) {
      return 5.0;
    }
    if (kind == CandidateKind.DEFENSIVE_COORDINATOR
        && (hcArchetype == CandidateArchetype.DEFENSIVE_PLAY_CALLER
            || hcArchetype == CandidateArchetype.DEFENSIVE_GURU)
        && (coordArchetype == CandidateArchetype.DEFENSIVE_PLAY_CALLER
            || coordArchetype == CandidateArchetype.DEFENSIVE_GURU)) {
      return 5.0;
    }
    return 0.0;
  }

  private double positionCoachBias(
      GeneratedCandidate g, SpecialtyPosition specialty, Optional<Candidate> hc) {
    if (hc.isEmpty()) {
      return 0.0;
    }
    return hc.get().specialtyPosition() == specialty ? 4.0 : 0.0;
  }

  private double scoutBias(GeneratedCandidate g, ScoutBranch branch, Optional<Candidate> dos) {
    if (dos.isEmpty()) {
      return 0.0;
    }
    var dosArchetype = dos.get().archetype();
    if (branch == ScoutBranch.COLLEGE && dosArchetype == CandidateArchetype.COLLEGE_EVALUATOR) {
      return 4.0;
    }
    if (branch == ScoutBranch.PRO && dosArchetype == CandidateArchetype.PRO_EVALUATOR) {
      return 4.0;
    }
    if (dosArchetype == CandidateArchetype.GENERALIST) {
      return 2.0;
    }
    return 0.0;
  }

  private void persistAndHire(
      long teamId,
      long poolId,
      GeneratedCandidate pick,
      StaffRole role,
      Optional<ScoutBranch> scoutBranch) {
    var insert =
        new NewCandidate(
            poolId,
            pick.candidate().kind(),
            pick.candidate().specialtyPosition(),
            pick.candidate().archetype(),
            pick.candidate().firstName(),
            pick.candidate().lastName(),
            pick.candidate().age(),
            pick.candidate().totalExperienceYears(),
            pick.candidate().experienceByRole(),
            pick.candidate().hiddenAttrs(),
            pick.candidate().scoutBranch());
    var saved = candidates.insert(insert);
    preferences.insert(pick.preferences().withCandidateId(saved.id()));
    candidates.markHired(saved.id(), teamId);
    staff.insert(new NewTeamStaffMember(teamId, saved.id(), role, scoutBranch, PHASE, 1));
  }
}
