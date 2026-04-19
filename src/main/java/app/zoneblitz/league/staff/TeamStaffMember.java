package app.zoneblitz.league.staff;

import app.zoneblitz.league.hiring.ScoutBranch;
import app.zoneblitz.league.phase.LeaguePhase;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/**
 * Terminal staff-seat hire for a team. {@code scoutBranch} is only populated when {@link #role()}
 * is {@code COLLEGE_SCOUT} or {@code PRO_SCOUT}.
 */
public record TeamStaffMember(
    long id,
    long teamId,
    long candidateId,
    StaffRole role,
    Optional<ScoutBranch> scoutBranch,
    LeaguePhase hiredAtPhase,
    int hiredAtDay,
    Instant hiredAt) {

  public TeamStaffMember {
    Objects.requireNonNull(role, "role");
    Objects.requireNonNull(scoutBranch, "scoutBranch");
    Objects.requireNonNull(hiredAtPhase, "hiredAtPhase");
    Objects.requireNonNull(hiredAt, "hiredAt");
  }
}
