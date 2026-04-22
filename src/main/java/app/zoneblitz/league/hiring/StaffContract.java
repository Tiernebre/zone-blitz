package app.zoneblitz.league.hiring;

import java.util.Objects;
import java.util.Optional;

/**
 * A signed staff contract between a team and a candidate. APY, guarantee, and term are locked at
 * signing. {@code terminatedAtSeason} is populated when the contract is ended before {@code
 * endSeason} (e.g. coach fired); remaining guaranteed money continues to count as dead cap through
 * {@code endSeason}.
 */
public record StaffContract(
    long id,
    long teamId,
    long candidateId,
    long teamStaffId,
    long apyCents,
    long guaranteeCents,
    int contractYears,
    int startSeason,
    int endSeason,
    Optional<Integer> terminatedAtSeason) {

  public StaffContract {
    Objects.requireNonNull(terminatedAtSeason, "terminatedAtSeason");
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
    if (terminatedAtSeason.isPresent()) {
      var t = terminatedAtSeason.get();
      if (t < startSeason || t > endSeason) {
        throw new IllegalArgumentException(
            "terminatedAtSeason must be within [startSeason, endSeason]");
      }
    }
  }
}
