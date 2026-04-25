package app.zoneblitz.gamesimulator.scheme;

/**
 * Stable identifier for an offensive scheme. The named families anchor the {@code
 * archetype-to-scheme} mapping and provide a typed key that scouting / hiring layers can compare
 * against. Adding a new scheme is additive — append a constant and ship its data file.
 */
public enum OffensiveSchemeId {
  WEST_COAST,
  AIR_RAID,
  SPREAD_OPTION,
  SMASHMOUTH,
  MCVAY_WIDE_ZONE,
  ERHARDT_PERKINS
}
