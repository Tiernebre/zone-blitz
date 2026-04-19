package app.zoneblitz.gamesimulator.event;

/**
 * Tier of injury severity carried by an {@link PlayEvent.Injury}. The engine consumes the tier to
 * decide how long the player is unavailable, and downstream features (UI, post-game reports,
 * roster/depth-chart screens) consume it for narrative.
 *
 * <p>Within a single simulated game the engine treats every tier except {@link #PLAY} as removing
 * the player from the remainder of the current game; the differences above {@link #GAME_ENDING}
 * matter for follow-up week-over-week scheduling that the simulator does not own.
 */
public enum InjurySeverity {
  /** Removed from the current play only; counted for injury stats. */
  PLAY,
  /** Removed for the remainder of the current drive. */
  DRIVE,
  /** Removed for the remainder of the current game. */
  GAME_ENDING,
  /** Removed for the current game and at least one subsequent game. */
  MULTI_GAME
}
