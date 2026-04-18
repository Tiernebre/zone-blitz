package app.zoneblitz.gamesimulator.event;

/**
 * Pre-snap down number (1-4) and yards to go for a first down. {@code down} of 0 indicates a phase
 * in which down/distance is not meaningful (e.g. kickoff).
 */
public record DownAndDistance(int down, int yardsToGo) {}
