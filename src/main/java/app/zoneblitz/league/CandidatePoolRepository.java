package app.zoneblitz.league;

import java.util.List;
import java.util.Optional;

/** Feature-internal persistence seam for {@link CandidatePool}. */
interface CandidatePoolRepository {

  /** Insert a new pool. */
  CandidatePool insert(long leagueId, LeaguePhase phase, CandidatePoolType type);

  /** Lookup by id; empty when absent. */
  Optional<CandidatePool> findById(long id);

  /**
   * Lookup by the {@code (leagueId, phase, type)} uniqueness key. Empty when no pool has been
   * generated for that combination.
   */
  Optional<CandidatePool> findByLeaguePhaseAndType(
      long leagueId, LeaguePhase phase, CandidatePoolType type);

  /** All pools for a league, newest first. */
  List<CandidatePool> findAllForLeague(long leagueId);
}
