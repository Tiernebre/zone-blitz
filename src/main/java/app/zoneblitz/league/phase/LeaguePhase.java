package app.zoneblitz.league.phase;

public enum LeaguePhase {
  INITIAL_SETUP,
  HIRING_HEAD_COACH,
  HIRING_DIRECTOR_OF_SCOUTING,
  ASSEMBLING_STAFF,
  /**
   * Placeholder terminal phase reached after {@link #ASSEMBLING_STAFF} completes. Subsequent phases
   * (inaugural draft prep, season, etc.) are out of scope for v1; this phase exists so the phase
   * state machine has somewhere to land and the dashboard has a stable post-staff state.
   */
  COMPLETE
}
