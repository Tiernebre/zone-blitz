package app.zoneblitz.league.hiring;

/**
 * Feature-public use case for conducting an interview against a shortlisted Head Coach candidate.
 *
 * <p>Each completed interview:
 *
 * <ul>
 *   <li>Increments the franchise's interview count against that candidate; each step reduces the
 *       scouted-signal σ per {@link InterviewNoiseModel}, with diminishing returns and a hard
 *       tier-dependent floor (σ never reaches 0).
 *   <li>Counts against the franchise's weekly interview capacity (default 3/week).
 *   <li>Persists a new scouted-overall estimate derived from the candidate's hidden true rating
 *       plus noise at the current σ. The shared {@code candidates.scouted_attrs} column is never
 *       written to — the hidden true rating never leaks into the shared column.
 *   <li>Appends the candidate id to {@code franchise_hiring_states.interviewing_candidate_ids},
 *       which records the per-franchise interview history (one entry per interview event).
 * </ul>
 *
 * Returns {@link InterviewResult.Started} on success, {@link InterviewResult.CapacityReached} when
 * the franchise has already hit the weekly cap, {@link InterviewResult.NotFound} when the league is
 * not owned or not in HC hiring, and {@link InterviewResult.UnknownCandidate} when the candidate id
 * does not map to this league's HC pool.
 */
public interface StartInterview {

  int DEFAULT_WEEKLY_CAPACITY = 3;

  InterviewResult start(long leagueId, long candidateId, String ownerSubject);
}
