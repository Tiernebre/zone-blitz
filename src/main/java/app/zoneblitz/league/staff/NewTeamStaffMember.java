package app.zoneblitz.league.staff;

import app.zoneblitz.league.hiring.ScoutBranch;
import app.zoneblitz.league.phase.LeaguePhase;
import java.util.Objects;
import java.util.Optional;

/** Insert-side DTO for {@link TeamStaffRepository#insert(NewTeamStaffMember)}. */
public record NewTeamStaffMember(
    long teamId,
    long candidateId,
    StaffRole role,
    Optional<ScoutBranch> scoutBranch,
    LeaguePhase hiredAtPhase,
    int hiredAtDay) {

  public NewTeamStaffMember {
    Objects.requireNonNull(role, "role");
    Objects.requireNonNull(scoutBranch, "scoutBranch");
    Objects.requireNonNull(hiredAtPhase, "hiredAtPhase");
  }
}
