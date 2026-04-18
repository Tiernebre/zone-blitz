package app.zoneblitz.gamesimulator.formation;

/**
 * Coarse-grained defensive coverage classification: is this a man concept, a zone concept, or
 * something else (combo/bracket/specials)?
 *
 * <p>{@link CoverageShell} is the specific call (Cover-1/3/Quarters/…); this type is what you get
 * if you bucket those shells.
 */
public enum CoverageType {
  MAN,
  ZONE,
  OTHER
}
