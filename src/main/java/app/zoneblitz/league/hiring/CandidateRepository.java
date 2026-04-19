package app.zoneblitz.league;

import java.util.List;
import java.util.Optional;

/** Feature-internal persistence seam for {@link Candidate}. */
interface CandidateRepository {

  /**
   * Insert a candidate into the given pool. {@code hiredByTeamId} and {@code scoutBranch} default
   * to empty/null on insert.
   */
  Candidate insert(NewCandidate newCandidate);

  Optional<Candidate> findById(long id);

  /** All candidates in the pool, ordered by id ascending. */
  List<Candidate> findAllByPoolId(long poolId);

  /**
   * Mark the candidate as hired by a team. Returns true when the update hit a row.
   *
   * <p>Does not enforce one-hire-per-candidate at this layer; higher-level use cases gate that.
   */
  boolean markHired(long candidateId, long teamId);
}
