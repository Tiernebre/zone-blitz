package app.zoneblitz.gamesimulator.event;

/**
 * A spot on the field, expressed as yards from the possessing team's own goal line (0..100). 0 is
 * the possessing team's end zone; 100 is the opposing end zone.
 */
public record FieldPosition(int yardLine) {}
