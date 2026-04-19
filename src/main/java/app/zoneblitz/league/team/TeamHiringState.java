package app.zoneblitz.league.team;

import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.phase.LeaguePhase;
import java.util.List;
import java.util.Objects;

/** Per-team hiring sub-state for a hiring phase. */
public record TeamHiringState(
    long id, long teamId, LeaguePhase phase, HiringStep step, List<Long> interviewingCandidateIds) {

  public TeamHiringState {
    Objects.requireNonNull(phase, "phase");
    Objects.requireNonNull(step, "step");
    interviewingCandidateIds = List.copyOf(interviewingCandidateIds);
  }
}
