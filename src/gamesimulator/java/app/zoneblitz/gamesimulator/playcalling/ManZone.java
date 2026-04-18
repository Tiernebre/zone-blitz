package app.zoneblitz.gamesimulator.playcalling;

/**
 * Man/zone split of a defensive coverage call. A coarser view than {@link
 * app.zoneblitz.gamesimulator.formation.CoverageShell}: {@code CoverageShell} carries a
 * deterministic {@link app.zoneblitz.gamesimulator.formation.CoverageType}, but for the tendency
 * layer callers often only need the high-level decision.
 */
public enum ManZone {
  MAN,
  ZONE
}
