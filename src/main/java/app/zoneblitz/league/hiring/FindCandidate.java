package app.zoneblitz.league.hiring;

import java.util.Optional;

/**
 * Feature-public lookup seam for a single {@link Candidate} by id. Provided so cross-feature
 * consumers that need to render a hired candidate (staff recap, org charts, etc.) stay off the
 * hiring-internal {@code CandidateRepository}.
 */
public interface FindCandidate {

  /**
   * Look up a candidate by id.
   *
   * @param candidateId the candidate primary key.
   * @return the candidate, or empty when the id does not resolve. Does not filter by hired status —
   *     the caller decides whether an un-hired candidate matters in its context.
   */
  Optional<Candidate> findById(long candidateId);
}
