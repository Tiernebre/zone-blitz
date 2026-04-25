package app.zoneblitz.gamesimulator.roster;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.rng.RandomSource;

/**
 * Generates a single {@link Player} at a given {@link Position} with attributes drawn from the
 * position's attribute profile. Implementations are deterministic given the {@link RandomSource}
 * stream — same seed, same player.
 *
 * <p>This is the seam through which "all-50 default rosters" is replaced with realistic correlated
 * attribute shapes. Consumers (e.g., a roster generator) supply the {@link PlayerId} and player
 * name independently.
 */
public interface PlayerGenerator {

  Player generate(PlayerId id, Position position, String displayName, RandomSource rng);
}
