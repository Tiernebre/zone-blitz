package app.zoneblitz.gamesimulator;

/**
 * Decides what play the offense runs at a given game state. Implementations range from scripted
 * (tests) to tendency-driven (production).
 */
public interface PlayCaller {

  /**
   * Return the offensive play call for the supplied state. The returned {@link PlayCall} is an
   * opaque placeholder for F1; later tasks replace it with a real sealed hierarchy.
   */
  PlayCall call(GameState state);

  /** Opaque play-call placeholder for F1. Later tasks replace this with a richer type. */
  record PlayCall(String kind) {}
}
