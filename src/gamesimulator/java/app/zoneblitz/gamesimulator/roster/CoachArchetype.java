package app.zoneblitz.gamesimulator.roster;

/**
 * Sim-side coach archetype. Mirrors the shape of {@code
 * app.zoneblitz.league.hiring.CandidateArchetype} but lives inside the gamesimulator module so the
 * engine never depends on the league/hiring module. Translation happens at the boundary (when staff
 * is hired and a {@link Coach} record is built for the sim).
 *
 * <p>Drives scheme resolution and play-call style. Scout-flavored archetypes from the league side
 * (college/pro evaluators) are intentionally absent — they don't influence game-time decisions.
 */
public enum CoachArchetype {
  CEO,
  OFFENSIVE_PLAY_CALLER,
  DEFENSIVE_PLAY_CALLER,
  OFFENSIVE_GURU,
  DEFENSIVE_GURU,
  TEACHER,
  TACTICIAN,
  GENERALIST
}
