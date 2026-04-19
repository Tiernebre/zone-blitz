package app.zoneblitz.league.staff;

import app.zoneblitz.league.phase.LeaguePhase;
import java.util.Optional;

/**
 * Read-only use case backing the {@link LeaguePhase#ASSEMBLING_STAFF} recap page. Returns the
 * league-wide staff tree for every franchise with the requesting user's franchise hoisted to the
 * top of the returned list.
 */
public interface ViewStaffRecap {

  /**
   * Build the recap view for the given league.
   *
   * @return {@link Optional#empty()} when the league does not exist or is not owned by {@code
   *     ownerSubject}.
   */
  Optional<StaffRecapView> view(long leagueId, String ownerSubject);
}
