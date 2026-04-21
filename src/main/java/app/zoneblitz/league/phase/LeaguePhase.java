package app.zoneblitz.league.phase;

public enum LeaguePhase {
  INITIAL_SETUP("Initial Setup"),
  HIRING_HEAD_COACH("Hiring Head Coach"),
  HIRING_DIRECTOR_OF_SCOUTING("Hiring Director of Scouting"),
  EXPANSION_DRAFT_SCOUTING("Expansion Draft Scouting"),
  ASSEMBLING_STAFF("Assembling Staff"),
  /**
   * Placeholder terminal phase reached after {@link #ASSEMBLING_STAFF} completes. Subsequent phases
   * (inaugural draft prep, season, etc.) are out of scope for v1; this phase exists so the phase
   * state machine has somewhere to land and the dashboard has a stable post-staff state.
   */
  COMPLETE("Complete");

  private final String displayName;

  LeaguePhase(String displayName) {
    this.displayName = displayName;
  }

  public String displayName() {
    return displayName;
  }
}
