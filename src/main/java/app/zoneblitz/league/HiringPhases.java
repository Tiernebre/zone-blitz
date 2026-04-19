package app.zoneblitz.league;

import java.util.Optional;

/**
 * Utility mapping for hiring-phase concerns shared between the HC and DoS phases: the candidate
 * pool type to look up, and the terminal staff role the phase produces. Keeps the gate on "is this
 * a hiring phase?" centralized so services can accept either hiring phase without sprinkling {@code
 * switch} ladders through every use case.
 */
final class HiringPhases {

  private HiringPhases() {}

  /**
   * Candidate pool type the given phase draws from, or empty if the phase is not a hiring phase.
   */
  static Optional<CandidatePoolType> poolTypeFor(LeaguePhase phase) {
    return switch (phase) {
      case HIRING_HEAD_COACH -> Optional.of(CandidatePoolType.HEAD_COACH);
      case HIRING_DIRECTOR_OF_SCOUTING -> Optional.of(CandidatePoolType.DIRECTOR_OF_SCOUTING);
      case INITIAL_SETUP, ASSEMBLING_STAFF -> Optional.empty();
    };
  }

  /** Terminal staff role produced by a hire in this phase. */
  static StaffRole staffRoleFor(LeaguePhase phase) {
    return switch (phase) {
      case HIRING_HEAD_COACH -> StaffRole.HEAD_COACH;
      case HIRING_DIRECTOR_OF_SCOUTING -> StaffRole.DIRECTOR_OF_SCOUTING;
      case INITIAL_SETUP, ASSEMBLING_STAFF ->
          throw new IllegalArgumentException("no staff role for non-hiring phase " + phase);
    };
  }

  static boolean isHiring(LeaguePhase phase) {
    return poolTypeFor(phase).isPresent();
  }
}
