package app.zoneblitz.league.hiring;

import java.util.Optional;

/**
 * Fluent builder for {@link StaffContract} and {@link NewStaffContract} in test code. Starts from
 * realistic defaults; {@code with*} methods override individual fields.
 */
final class StaffContractBuilder {

  private long id = 1L;
  private long teamId = 1L;
  private long candidateId = 1L;
  private long teamStaffId = 1L;
  private long apyCents = 8_500_000_00L;
  private long guaranteeCents = 8_500_000_00L;
  private int contractYears = 5;
  private int startSeason = 1;
  private int endSeason = 5;
  private Optional<Integer> terminatedAtSeason = Optional.empty();

  static StaffContractBuilder aStaffContract() {
    return new StaffContractBuilder();
  }

  StaffContractBuilder withId(long id) {
    this.id = id;
    return this;
  }

  StaffContractBuilder withTeamId(long teamId) {
    this.teamId = teamId;
    return this;
  }

  StaffContractBuilder withCandidateId(long candidateId) {
    this.candidateId = candidateId;
    return this;
  }

  StaffContractBuilder withTeamStaffId(long teamStaffId) {
    this.teamStaffId = teamStaffId;
    return this;
  }

  StaffContractBuilder withApyCents(long apyCents) {
    this.apyCents = apyCents;
    return this;
  }

  StaffContractBuilder withGuaranteeCents(long guaranteeCents) {
    this.guaranteeCents = guaranteeCents;
    return this;
  }

  StaffContractBuilder withContractYears(int contractYears) {
    this.contractYears = contractYears;
    return this;
  }

  StaffContractBuilder withStartSeason(int startSeason) {
    this.startSeason = startSeason;
    return this;
  }

  StaffContractBuilder withEndSeason(int endSeason) {
    this.endSeason = endSeason;
    return this;
  }

  StaffContractBuilder withSeasons(int startSeason, int endSeason) {
    this.startSeason = startSeason;
    this.endSeason = endSeason;
    return this;
  }

  StaffContractBuilder withTerminatedAtSeason(int terminatedAtSeason) {
    this.terminatedAtSeason = Optional.of(terminatedAtSeason);
    return this;
  }

  StaffContract build() {
    return new StaffContract(
        id,
        teamId,
        candidateId,
        teamStaffId,
        apyCents,
        guaranteeCents,
        contractYears,
        startSeason,
        endSeason,
        terminatedAtSeason);
  }

  NewStaffContract buildNew() {
    return new NewStaffContract(
        teamId,
        candidateId,
        teamStaffId,
        apyCents,
        guaranteeCents,
        contractYears,
        startSeason,
        endSeason);
  }
}
