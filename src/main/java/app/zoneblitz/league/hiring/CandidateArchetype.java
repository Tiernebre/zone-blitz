package app.zoneblitz.league.hiring;

/**
 * Categorical archetype tag. HC archetypes come first; other kinds' archetype sets are placeholders
 * per the design doc and will expand as band files author them.
 */
public enum CandidateArchetype {
  CEO("CEO"),
  OFFENSIVE_PLAY_CALLER("Offensive Play-Caller"),
  DEFENSIVE_PLAY_CALLER("Defensive Play-Caller"),
  OFFENSIVE_GURU("Offensive Guru"),
  DEFENSIVE_GURU("Defensive Guru"),
  TEACHER("Teacher"),
  TACTICIAN("Tactician"),
  COLLEGE_EVALUATOR("College Evaluator"),
  PRO_EVALUATOR("Pro Evaluator"),
  GENERALIST("Generalist");

  private final String displayName;

  CandidateArchetype(String displayName) {
    this.displayName = displayName;
  }

  public String displayName() {
    return displayName;
  }
}
