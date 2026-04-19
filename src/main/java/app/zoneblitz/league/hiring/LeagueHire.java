package app.zoneblitz.league.hiring;

import app.zoneblitz.league.staff.SpecialtyPosition;
import java.util.Objects;
import java.util.Optional;

/**
 * One row of the league-wide hiring board for a given pool: one per team in the league. {@code
 * hire} is present iff that team has already hired a candidate from this pool; empty means the seat
 * is still open.
 */
public record LeagueHire(
    long teamId,
    String franchiseName,
    String cityName,
    boolean isViewerTeam,
    Optional<HiredCandidateBrief> hire) {

  public LeagueHire {
    Objects.requireNonNull(franchiseName, "franchiseName");
    Objects.requireNonNull(cityName, "cityName");
    Objects.requireNonNull(hire, "hire");
  }

  /** Minimal candidate snapshot shown on the league board — name + archetype + specialty. */
  public record HiredCandidateBrief(
      long candidateId, String name, CandidateArchetype archetype, SpecialtyPosition specialty) {

    public HiredCandidateBrief {
      Objects.requireNonNull(name, "name");
      Objects.requireNonNull(archetype, "archetype");
      Objects.requireNonNull(specialty, "specialty");
    }
  }
}
