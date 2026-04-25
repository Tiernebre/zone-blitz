package app.zoneblitz.gamesimulator.scheme;

/**
 * Provides {@link OffensiveScheme} and {@link DefensiveScheme} records by id. Implementations
 * source schemes from hardcoded data, classpath JSON, or test fixtures. The {@link SchemeResolver}
 * consumes a catalog to materialize {@link ResolvedScheme}s once it's chosen the ids per side.
 */
public interface SchemeCatalog {

  OffensiveScheme offense(OffensiveSchemeId id);

  DefensiveScheme defense(DefensiveSchemeId id);
}
