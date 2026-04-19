package app.zoneblitz.league;

import java.util.List;
import java.util.Objects;

/**
 * Per-team hiring sub-state for a hiring phase. {@code shortlist} and {@code
 * interviewingCandidateIds} are carried as candidate-id lists.
 */
public record TeamHiringState(
    long id,
    long teamId,
    LeaguePhase phase,
    HiringStep step,
    List<Long> shortlist,
    List<Long> interviewingCandidateIds) {

  public TeamHiringState {
    Objects.requireNonNull(phase, "phase");
    Objects.requireNonNull(step, "step");
    shortlist = List.copyOf(shortlist);
    interviewingCandidateIds = List.copyOf(interviewingCandidateIds);
  }
}
