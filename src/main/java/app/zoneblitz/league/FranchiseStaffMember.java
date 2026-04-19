package app.zoneblitz.league;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

/**
 * Terminal staff-seat hire for a franchise. {@code scoutBranch} is only populated when {@link
 * #role()} is {@code COLLEGE_SCOUT} or {@code PRO_SCOUT}.
 */
public record FranchiseStaffMember(
    long id,
    long leagueId,
    long franchiseId,
    long candidateId,
    StaffRole role,
    Optional<ScoutBranch> scoutBranch,
    LeaguePhase hiredAtPhase,
    int hiredAtWeek,
    Instant hiredAt) {

  public FranchiseStaffMember {
    Objects.requireNonNull(role, "role");
    Objects.requireNonNull(scoutBranch, "scoutBranch");
    Objects.requireNonNull(hiredAtPhase, "hiredAtPhase");
    Objects.requireNonNull(hiredAt, "hiredAt");
  }
}
