package app.zoneblitz.league;

import java.util.Optional;

/**
 * Feature-public use case: load the HIRING_HEAD_COACH page view-model for the user's franchise.
 * Empty when the league does not exist, is not owned by the user, or is not in the HC hiring phase.
 */
public interface ViewHeadCoachHiring {

  /**
   * @param leagueId the target league.
   * @param ownerSubject the OAuth subject of the requesting user.
   * @return the view-model, or empty if the league is missing / not owned / not in the HC phase.
   */
  Optional<HeadCoachHiringView> view(long leagueId, String ownerSubject);
}
