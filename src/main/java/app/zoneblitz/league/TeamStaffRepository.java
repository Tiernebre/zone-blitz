package app.zoneblitz.league;

import java.util.List;
import java.util.Optional;

/** Feature-internal persistence seam for {@link TeamStaffMember}. */
interface TeamStaffRepository {

  /** Insert a new terminal staff hire. */
  TeamStaffMember insert(NewTeamStaffMember hire);

  Optional<TeamStaffMember> findById(long id);

  /** All staff for one team, ordered by role enum order. */
  List<TeamStaffMember> findAllForTeam(long teamId);
}
