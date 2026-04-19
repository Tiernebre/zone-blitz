package app.zoneblitz.league;

import java.util.Optional;

/**
 * Seam returning a {@link FranchiseProfile} for preference scoring. One implementation per wiring
 * of city data; v1 derives static fields from the franchise's seeded city and returns equal-footing
 * constants for dynamic fields.
 */
interface FranchiseProfiles {

  Optional<FranchiseProfile> forFranchise(long franchiseId);
}
