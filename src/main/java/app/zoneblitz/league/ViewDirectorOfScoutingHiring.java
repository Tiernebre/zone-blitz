package app.zoneblitz.league;

import java.util.Optional;

/**
 * Feature-public use case: load the HIRING_DIRECTOR_OF_SCOUTING page view-model for the user's
 * franchise. Empty when the league does not exist, is not owned by the user, or is not in the DoS
 * hiring phase.
 */
public interface ViewDirectorOfScoutingHiring {

  /**
   * @param leagueId the target league.
   * @param ownerSubject the OAuth subject of the requesting user.
   * @return the view-model, or empty if the league is missing / not owned / not in the DoS phase.
   */
  Optional<DirectorOfScoutingHiringView> view(long leagueId, String ownerSubject);
}
