package app.zoneblitz.league.hiring;

/** Write-side record used by {@link StaffContractRepository#insert(NewStaffContract)}. */
record NewStaffContract(
    long teamId,
    long candidateId,
    long teamStaffId,
    long apyCents,
    long guaranteeCents,
    int contractYears,
    int startSeason,
    int endSeason) {

  NewStaffContract {
    if (apyCents <= 0) {
      throw new IllegalArgumentException("apyCents must be > 0");
    }
    if (guaranteeCents < 0) {
      throw new IllegalArgumentException("guaranteeCents must be >= 0");
    }
    if (contractYears <= 0) {
      throw new IllegalArgumentException("contractYears must be > 0");
    }
    if (endSeason < startSeason) {
      throw new IllegalArgumentException("endSeason must be >= startSeason");
    }
  }
}
