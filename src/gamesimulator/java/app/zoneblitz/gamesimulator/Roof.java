package app.zoneblitz.gamesimulator;

/**
 * Stadium roof configuration at kickoff. {@link #DOME} and {@link #RETRACTABLE_CLOSED} eliminate
 * weather effects; {@link #OPEN_AIR} and {@link #RETRACTABLE_OPEN} let them through.
 */
public enum Roof {
  OPEN_AIR,
  DOME,
  RETRACTABLE_OPEN,
  RETRACTABLE_CLOSED;

  /** True when the roof shields the field from wind and precipitation. */
  public boolean isEnclosed() {
    return this == DOME || this == RETRACTABLE_CLOSED;
  }
}
