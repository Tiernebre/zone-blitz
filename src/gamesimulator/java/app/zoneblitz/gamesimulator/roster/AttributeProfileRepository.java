package app.zoneblitz.gamesimulator.roster;

/**
 * Loads the {@link AttributeProfile} for a {@link Position}. Implementations may read from the
 * classpath, a database, or in-memory test fixtures.
 */
public interface AttributeProfileRepository {

  AttributeProfile loadFor(Position position);
}
