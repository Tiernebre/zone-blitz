package app.zoneblitz.gamesimulator.event;

/** Rushing play concept used to classify a {@link PlayEvent.Run}. */
public enum RunConcept {
  INSIDE_ZONE,
  OUTSIDE_ZONE,
  POWER,
  COUNTER,
  DRAW,
  TRAP,
  SWEEP,
  QB_SNEAK,
  QB_DRAW,
  OTHER
}
