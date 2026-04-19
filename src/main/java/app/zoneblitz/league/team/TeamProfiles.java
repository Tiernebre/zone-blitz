package app.zoneblitz.league;

import java.util.Optional;

/**
 * Seam returning a {@link TeamProfile} for preference scoring. One implementation per wiring of
 * city data; v1 derives static fields from the team's franchise city and returns equal-footing
 * constants for dynamic fields.
 */
interface TeamProfiles {

  Optional<TeamProfile> forTeam(long teamId);
}
