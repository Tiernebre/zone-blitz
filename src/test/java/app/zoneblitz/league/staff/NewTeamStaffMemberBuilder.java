package app.zoneblitz.league.staff;

import app.zoneblitz.league.hiring.ScoutBranch;
import app.zoneblitz.league.phase.LeaguePhase;
import java.util.Optional;

/**
 * Fluent builder for {@link NewTeamStaffMember} in test code. Defaults produce a plausible valid
 * instance (team 1 hiring candidate 1 as head coach, no scout branch, on day 1 of the HC phase);
 * {@code with*} methods override individual fields.
 */
final class NewTeamStaffMemberBuilder {

  private long teamId = 1L;
  private long candidateId = 1L;
  private StaffRole role = StaffRole.HEAD_COACH;
  private Optional<ScoutBranch> scoutBranch = Optional.empty();
  private LeaguePhase hiredAtPhase = LeaguePhase.HIRING_HEAD_COACH;
  private int hiredAtDay = 1;

  static NewTeamStaffMemberBuilder aNewTeamStaffMember() {
    return new NewTeamStaffMemberBuilder();
  }

  NewTeamStaffMemberBuilder withTeamId(long teamId) {
    this.teamId = teamId;
    return this;
  }

  NewTeamStaffMemberBuilder withCandidateId(long candidateId) {
    this.candidateId = candidateId;
    return this;
  }

  NewTeamStaffMemberBuilder withRole(StaffRole role) {
    this.role = role;
    return this;
  }

  NewTeamStaffMemberBuilder withScoutBranch(ScoutBranch scoutBranch) {
    this.scoutBranch = Optional.of(scoutBranch);
    return this;
  }

  NewTeamStaffMemberBuilder withoutScoutBranch() {
    this.scoutBranch = Optional.empty();
    return this;
  }

  NewTeamStaffMemberBuilder withHiredAtPhase(LeaguePhase hiredAtPhase) {
    this.hiredAtPhase = hiredAtPhase;
    return this;
  }

  NewTeamStaffMemberBuilder withHiredAtDay(int hiredAtDay) {
    this.hiredAtDay = hiredAtDay;
    return this;
  }

  NewTeamStaffMember build() {
    return new NewTeamStaffMember(teamId, candidateId, role, scoutBranch, hiredAtPhase, hiredAtDay);
  }
}
