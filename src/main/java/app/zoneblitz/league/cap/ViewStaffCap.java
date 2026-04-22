package app.zoneblitz.league.cap;

import java.util.Optional;

/**
 * View the staff salary cap for the caller's team in {@code leagueId}. Returns empty when no league
 * with that id is owned by {@code ownerSubject}. The view is always derived for the league's
 * current season.
 */
public interface ViewStaffCap {

  Optional<StaffCapView> view(long leagueId, String ownerSubject);
}
