package app.zoneblitz.gamesimulator.event;

/**
 * Coarse game clock snapshot: the quarter (1..4, or 5+ for overtime) and seconds remaining in that
 * quarter.
 */
public record GameClock(int quarter, int secondsRemaining) {}
