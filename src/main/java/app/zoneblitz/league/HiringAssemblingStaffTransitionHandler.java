package app.zoneblitz.league;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Phase-entry hook for {@link LeaguePhase#ASSEMBLING_STAFF}. Programmatically assembles every
 * team's subordinate staff tree at phase entry:
 *
 * <ul>
 *   <li>The Head Coach hires 1 OC, 1 DC, 1 ST coordinator and 9 position coaches (QB, RB, WR, TE,
 *       OL, DL, EDGE, LB, DB) — 12 total.
 *   <li>The Director of Scouting hires 5 college scouts and 3 pro scouts — 8 total.
 * </ul>
 *
 * <p>Selection is biased by the HC's archetype/specialty (coordinator archetypes weighted toward HC
 * archetype, position coaches biased when HC specialty matches) and by the DoS archetype (college
 * vs pro emphasis on the scout branches). The bias is implemented at generation time — candidates
 * are generated per team with kind- and branch-appropriate archetypes, then ranked by scouted
 * overall with a small bias bonus so the top k are selected deterministically from the seeded RNG.
 *
 * <p>Idempotent: re-entry of a phase that already has at least one assembled staff row for a team
 * is a no-op for that team.
 */
@Component
class HiringAssemblingStaffTransitionHandler implements PhaseTransitionHandler {

  private static final Logger log =
      LoggerFactory.getLogger(HiringAssemblingStaffTransitionHandler.class);

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
  private final CoordinatorGenerator coordinatorGenerator;
  private final PositionCoachGenerator positionCoachGenerator;
  private final ScoutCandidateGenerator scoutGenerator;
  private final CandidateRandomSources rngs;

  HiringAssemblingStaffTransitionHandler(
      TeamLookup teams,
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      TeamStaffRepository staff,
      CoordinatorGenerator coordinatorGenerator,
      PositionCoachGenerator positionCoachGenerator,
      ScoutCandidateGenerator scoutGenerator,
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
  public LeaguePhase phase() {
    return LeaguePhase.ASSEMBLING_STAFF;
  }

  @Override
  public void onEntry(long leagueId) {
    var teamIds = teams.teamIdsForLeague(leagueId);
    if (teamIds.isEmpty()) {
      log.debug("no teams for league={}, assembling-staff is a no-op", leagueId);
      return;
    }
    var coordinatorPool = findOrCreatePool(leagueId, CandidatePoolType.COORDINATOR);
    var positionCoachPool = findOrCreatePool(leagueId, CandidatePoolType.POSITION_COACH);
    var scoutPool = findOrCreatePool(leagueId, CandidatePoolType.SCOUT);

    var rng = rngs.forLeaguePhase(leagueId, phase());
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
        .findByLeaguePhaseAndType(leagueId, phase(), type)
        .orElseGet(() -> pools.insert(leagueId, phase(), type));
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
      app.zoneblitz.gamesimulator.rng.RandomSource rng) {
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
      app.zoneblitz.gamesimulator.rng.RandomSource rng) {
    var generated = coordinatorGenerator.generate(GENERATION_OVERSAMPLE, kind, rng);
    var pick = pickBiased(generated, c -> coordinatorBias(c, kind, hc));
    persistAndHire(teamId, poolId, pick, role, Optional.empty());
  }

  private void hirePositionCoach(
      long teamId,
      long poolId,
      SpecialtyPosition specialty,
      Optional<Candidate> hc,
      app.zoneblitz.gamesimulator.rng.RandomSource rng) {
    var generated = positionCoachGenerator.generate(GENERATION_OVERSAMPLE, specialty, rng);
    var pick = pickBiased(generated, c -> positionCoachBias(c, specialty, hc));
    persistAndHire(teamId, poolId, pick, positionCoachRoleFor(specialty), Optional.empty());
  }

  private void hireScout(
      long teamId,
      long poolId,
      ScoutBranch branch,
      Optional<Candidate> dos,
      app.zoneblitz.gamesimulator.rng.RandomSource rng) {
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
    ranked.sort(
        Comparator.<GeneratedCandidate>comparingDouble(
                c -> scoutedOverall(c.candidate().scoutedAttrs()) + bias.applyAsDouble(c))
            .reversed());
    return ranked.getFirst();
  }

  private double coordinatorBias(GeneratedCandidate g, CandidateKind kind, Optional<Candidate> hc) {
    if (hc.isEmpty()) {
      return 0.0;
    }
    var hcArchetype = hc.get().archetype();
    var coordArchetype = g.candidate().archetype();
    // Boost when coordinator archetype matches HC's offensive/defensive lean.
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
            pick.candidate().age(),
            pick.candidate().totalExperienceYears(),
            pick.candidate().experienceByRole(),
            pick.candidate().hiddenAttrs(),
            pick.candidate().scoutedAttrs(),
            pick.candidate().scoutBranch());
    var saved = candidates.insert(insert);
    preferences.insert(pick.preferences().withCandidateId(saved.id()));
    candidates.markHired(saved.id(), teamId);
    staff.insert(new NewTeamStaffMember(teamId, saved.id(), role, scoutBranch, phase(), 1));
  }

  private static double scoutedOverall(String scoutedAttrsJson) {
    var idx = scoutedAttrsJson.indexOf("\"overall\"");
    if (idx < 0) {
      return 0.0;
    }
    var colon = scoutedAttrsJson.indexOf(':', idx);
    if (colon < 0) {
      return 0.0;
    }
    var end = scoutedAttrsJson.length();
    var stop = scoutedAttrsJson.indexOf(',', colon);
    var close = scoutedAttrsJson.indexOf('}', colon);
    if (stop >= 0) {
      end = Math.min(end, stop);
    }
    if (close >= 0) {
      end = Math.min(end, close);
    }
    try {
      return Double.parseDouble(scoutedAttrsJson.substring(colon + 1, end).trim());
    } catch (NumberFormatException ex) {
      return 0.0;
    }
  }
}
