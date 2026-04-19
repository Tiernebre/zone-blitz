package app.zoneblitz.league;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Phase-entry hook for {@link LeaguePhase#HIRING_DIRECTOR_OF_SCOUTING}. Mirrors {@link
 * HiringHeadCoachTransitionHandler}: generate the league-wide DoS candidate pool (if not already
 * present), persist candidates + preferences, and initialize each team's hiring sub-state to {@link
 * HiringStep#SEARCHING} with empty shortlist/interview lists.
 *
 * <p>Idempotent: re-entry of a phase that already has a pool is a no-op.
 */
@Component
class HiringDirectorOfScoutingTransitionHandler implements PhaseTransitionHandler {

  private static final Logger log =
      LoggerFactory.getLogger(HiringDirectorOfScoutingTransitionHandler.class);

  /** Per {@code docs/technical/league-phases.md}: pool size is 2–3× team count. */
  private static final int POOL_SIZE_PER_TEAM = 3;

  private final LeagueRepository leagues;
  private final TeamLookup teams;
  private final CandidatePoolRepository pools;
  private final CandidateRepository candidates;
  private final CandidatePreferencesRepository preferences;
  private final TeamHiringStateRepository hiringStates;
  private final DirectorOfScoutingGenerator generator;
  private final CandidateRandomSources rngs;

  HiringDirectorOfScoutingTransitionHandler(
      LeagueRepository leagues,
      TeamLookup teams,
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      TeamHiringStateRepository hiringStates,
      DirectorOfScoutingGenerator generator,
      CandidateRandomSources rngs) {
    this.leagues = leagues;
    this.teams = teams;
    this.pools = pools;
    this.candidates = candidates;
    this.preferences = preferences;
    this.hiringStates = hiringStates;
    this.generator = generator;
    this.rngs = rngs;
  }

  @Override
  public LeaguePhase phase() {
    return LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING;
  }

  @Override
  public void onEntry(long leagueId) {
    if (pools
        .findByLeaguePhaseAndType(leagueId, phase(), CandidatePoolType.DIRECTOR_OF_SCOUTING)
        .isPresent()) {
      log.debug("DoS pool already present for league={}; entry is a no-op", leagueId);
      return;
    }
    var league =
        leagues
            .findById(leagueId)
            .orElseThrow(() -> new IllegalStateException("league missing: " + leagueId));
    var teamIds = teams.teamIdsForLeague(leagueId);
    var poolSize = Math.max(1, teamIds.size() * POOL_SIZE_PER_TEAM);

    var pool = pools.insert(leagueId, phase(), CandidatePoolType.DIRECTOR_OF_SCOUTING);
    var rng = rngs.forLeaguePhase(leagueId, phase());
    var generated = generator.generate(poolSize, rng);
    for (var g : generated) {
      var withPool = attachPool(g.candidate(), pool.id());
      var saved = candidates.insert(withPool);
      preferences.insert(g.preferences().withCandidateId(saved.id()));
    }
    for (var teamId : teamIds) {
      hiringStates.upsert(
          new TeamHiringState(0L, teamId, phase(), HiringStep.SEARCHING, List.of(), List.of()));
    }
    log.info(
        "hiring director-of-scouting pool generated leagueId={} poolId={} size={} teams={}",
        league.id(),
        pool.id(),
        generated.size(),
        teamIds.size());
  }

  private static NewCandidate attachPool(NewCandidate candidate, long poolId) {
    return new NewCandidate(
        poolId,
        candidate.kind(),
        candidate.specialtyPosition(),
        candidate.archetype(),
        candidate.age(),
        candidate.totalExperienceYears(),
        candidate.experienceByRole(),
        candidate.hiddenAttrs(),
        candidate.scoutedAttrs(),
        candidate.scoutBranch());
  }
}
