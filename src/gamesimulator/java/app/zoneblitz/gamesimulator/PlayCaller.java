package app.zoneblitz.gamesimulator;

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

  /** Opaque play-call placeholder — will be replaced with a sealed hierarchy. */
  record PlayCall(String kind) {}
}
