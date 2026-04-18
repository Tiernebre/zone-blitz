package app.zoneblitz.gamesimulator;

/**
 * Competitive context for a simulated game. Governs overtime rules per the NFL rulebook:
 *
 * <ul>
 *   <li>{@link #REGULAR_SEASON} — modified sudden death. A single 10-minute OT period; both teams
 *       are guaranteed at least one possession (including after an opening-drive TD, per the 2024
 *       rule change). If still tied when the clock expires, the game ends in a tie.
 *   <li>{@link #PLAYOFFS} — modified sudden death for the first possession of the first period
 *       (both teams guaranteed a possession), then full sudden death. 15-minute periods continue
 *       until a winner is determined.
 * </ul>
 */
public enum GameType {
  REGULAR_SEASON,
  PLAYOFFS
}
