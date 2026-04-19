package app.zoneblitz.league;

import java.util.List;
import java.util.Optional;

/** Feature-internal persistence seam for {@link FranchiseStaffMember}. */
interface FranchiseStaffRepository {

  /** Insert a new terminal staff hire. */
  FranchiseStaffMember insert(NewFranchiseStaffMember hire);

  Optional<FranchiseStaffMember> findById(long id);

  /** All staff for one franchise in one league, ordered by role enum order. */
  List<FranchiseStaffMember> findAllForFranchise(long leagueId, long franchiseId);
}
