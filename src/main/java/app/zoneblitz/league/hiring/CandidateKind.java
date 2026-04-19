package app.zoneblitz.league.hiring;

/**
 * The kind of staff seat a {@link Candidate} is generated to fill.
 *
 * <p>Note: this is the per-candidate kind, more granular than {@link CandidatePoolType} which
 * identifies the pool the candidate was drawn from.
 */
public enum CandidateKind {
  HEAD_COACH,
  DIRECTOR_OF_SCOUTING,
  OFFENSIVE_COORDINATOR,
  DEFENSIVE_COORDINATOR,
  SPECIAL_TEAMS_COORDINATOR,
  POSITION_COACH,
  SCOUT
}
