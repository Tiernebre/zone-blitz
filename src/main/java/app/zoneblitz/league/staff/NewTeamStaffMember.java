package app.zoneblitz.league;

import java.util.Objects;
import java.util.Optional;

/** Insert-side DTO for {@link TeamStaffRepository#insert(NewTeamStaffMember)}. */
public record NewTeamStaffMember(
    long teamId,
    long candidateId,
    StaffRole role,
    Optional<ScoutBranch> scoutBranch,
    LeaguePhase hiredAtPhase,
    int hiredAtWeek) {

  public NewTeamStaffMember {
    Objects.requireNonNull(role, "role");
    Objects.requireNonNull(scoutBranch, "scoutBranch");
    Objects.requireNonNull(hiredAtPhase, "hiredAtPhase");
  }
}
