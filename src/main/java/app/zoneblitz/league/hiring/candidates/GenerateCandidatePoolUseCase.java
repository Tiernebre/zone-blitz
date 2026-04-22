package app.zoneblitz.league.hiring.candidates;

import app.zoneblitz.league.hiring.CandidateGenerator;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.CandidateRandomSources;
import app.zoneblitz.league.hiring.GenerateCandidatePool;
import app.zoneblitz.league.hiring.NewCandidate;
import app.zoneblitz.league.phase.LeaguePhase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class GenerateCandidatePoolUseCase implements GenerateCandidatePool {

  private static final Logger log = LoggerFactory.getLogger(GenerateCandidatePoolUseCase.class);

  private final CandidatePoolRepository pools;
  private final CandidateRepository candidates;
  private final CandidatePreferencesRepository preferences;
  private final CandidateRandomSources rngs;

  public GenerateCandidatePoolUseCase(
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      CandidateRandomSources rngs) {
    this.pools = pools;
    this.candidates = candidates;
    this.preferences = preferences;
    this.rngs = rngs;
  }

  @Override
  public boolean generateIfAbsent(
      long leagueId,
      LeaguePhase phase,
      CandidatePoolType poolType,
      CandidateGenerator generator,
      int poolSize) {
    if (pools.findByLeaguePhaseAndType(leagueId, phase, poolType).isPresent()) {
      log.debug(
          "pool already present leagueId={} phase={} type={} — no-op", leagueId, phase, poolType);
      return false;
    }
    var pool = pools.insert(leagueId, phase, poolType);
    var rng = rngs.forLeaguePhase(leagueId, phase);
    var generated = generator.generate(poolSize, rng);
    for (var g : generated) {
      var withPool = attachPool(g.candidate(), pool.id());
      var saved = candidates.insert(withPool);
      preferences.insert(g.preferences().withCandidateId(saved.id()));
    }
    log.info(
        "pool generated leagueId={} phase={} type={} poolId={} size={}",
        leagueId,
        phase,
        poolType,
        pool.id(),
        generated.size());
    return true;
  }

  private static NewCandidate attachPool(NewCandidate candidate, long poolId) {
    return new NewCandidate(
        poolId,
        candidate.kind(),
        candidate.specialtyPosition(),
        candidate.archetype(),
        candidate.firstName(),
        candidate.lastName(),
        candidate.age(),
        candidate.totalExperienceYears(),
        candidate.experienceByRole(),
        candidate.hiddenAttrs(),
        candidate.scoutBranch());
  }
}
