package app.zoneblitz.gamesimulator.clock;

/** Kick types whose inter-snap gap is sampled by {@link ClockModel#secondsConsumedForKick}. */
public enum Kick {
  PUNT,
  FIELD_GOAL,
  KICKOFF,
  EXTRA_POINT
}
