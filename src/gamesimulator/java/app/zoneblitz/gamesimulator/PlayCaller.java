package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.RunConcept;
import java.util.Objects;

/**
 * Decides what play the offense runs at a given game state. Implementations range from scripted
 * (tests) to tendency-driven (production).
 */
public interface PlayCaller {

  /**
   * Return the offensive play call for the supplied state. The returned {@link PlayCall} is an
   * opaque placeholder today; it will grow into a real sealed hierarchy as the decision layer
   * lands.
   */
  PlayCall call(GameState state);

  /**
   * Opaque play-call placeholder — will be replaced with a sealed hierarchy.
   *
   * <p>{@code runConcept} carries coach intent into the run resolver's matchup shift and is stamped
   * onto the resulting {@code RunOutcome.Run}. It's required (never null) so concept-aware scoring
   * has a value for every snap; pass calls simply ignore it. The single-arg convenience constructor
   * defaults to {@link RunConcept#INSIDE_ZONE}, which is the baseline-parity concept for the
   * clamped run-matchup shift.
   */
  record PlayCall(String kind, RunConcept runConcept) {
    public PlayCall {
      Objects.requireNonNull(kind, "kind");
      Objects.requireNonNull(runConcept, "runConcept");
    }

    public PlayCall(String kind) {
      this(kind, RunConcept.INSIDE_ZONE);
    }
  }
}
