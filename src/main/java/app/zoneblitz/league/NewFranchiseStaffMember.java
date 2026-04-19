package app.zoneblitz.league;

import java.util.Objects;
import java.util.Optional;

/** Insert-side DTO for {@link FranchiseStaffRepository#insert(NewFranchiseStaffMember)}. */
public record NewFranchiseStaffMember(
    long leagueId,
    long franchiseId,
    long candidateId,
    StaffRole role,
    Optional<ScoutBranch> scoutBranch,
    LeaguePhase hiredAtPhase,
    int hiredAtWeek) {

  public NewFranchiseStaffMember {
    Objects.requireNonNull(role, "role");
    Objects.requireNonNull(scoutBranch, "scoutBranch");
    Objects.requireNonNull(hiredAtPhase, "hiredAtPhase");
  }
}
