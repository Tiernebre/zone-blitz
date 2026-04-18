package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
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
   * onto the resulting {@code RunOutcome.Run}. {@code formation} feeds the pre-snap box-count and
   * coverage-shell samplers. All three fields are required. Convenience constructors default the
   * missing fields — formation defaults to {@link OffensiveFormation#SINGLEBACK} for runs and
   * {@link OffensiveFormation#SHOTGUN} for everything else, matching the modal real-NFL formation
   * for each play type.
   */
  record PlayCall(String kind, RunConcept runConcept, OffensiveFormation formation) {
    public PlayCall {
      Objects.requireNonNull(kind, "kind");
      Objects.requireNonNull(runConcept, "runConcept");
      Objects.requireNonNull(formation, "formation");
    }

    public PlayCall(String kind, RunConcept runConcept) {
      this(kind, runConcept, defaultFormation(kind));
    }

    public PlayCall(String kind) {
      this(kind, RunConcept.INSIDE_ZONE);
    }

    private static OffensiveFormation defaultFormation(String kind) {
      return "run".equalsIgnoreCase(kind)
          ? OffensiveFormation.SINGLEBACK
          : OffensiveFormation.SHOTGUN;
    }
  }
}
