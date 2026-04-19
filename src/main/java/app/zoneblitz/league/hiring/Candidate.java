package app.zoneblitz.league.hiring;

import app.zoneblitz.league.staff.SpecialtyPosition;
import java.util.Objects;
import java.util.Optional;

/**
 * A single candidate in a {@link CandidatePool}.
 *
 * <p>JSONB payloads ({@code experienceByRole}, {@code hiddenAttrs}) are carried as raw JSON strings
 * at this layer; the generator and consumers parse them into typed structures. {@code
 * hiredByTeamId} and {@code scoutBranch} are optional because they are populated later in the
 * candidate's lifecycle (on hire) or only for scout candidates.
 *
 * @param experienceByRole JSON object mapping role name to years, e.g. {@code {"OC": 10, "HC": 0}}.
 * @param hiddenAttrs the never-revealed true-rating attribute payload. Must not be surfaced to UI.
 */
public record Candidate(
    long id,
    long poolId,
    CandidateKind kind,
    SpecialtyPosition specialtyPosition,
    CandidateArchetype archetype,
    String firstName,
    String lastName,
    int age,
    int totalExperienceYears,
    String experienceByRole,
    String hiddenAttrs,
    Optional<Long> hiredByTeamId,
    Optional<ScoutBranch> scoutBranch) {

  public Candidate {
    Objects.requireNonNull(kind, "kind");
    Objects.requireNonNull(specialtyPosition, "specialtyPosition");
    Objects.requireNonNull(archetype, "archetype");
    Objects.requireNonNull(firstName, "firstName");
    Objects.requireNonNull(lastName, "lastName");
    Objects.requireNonNull(experienceByRole, "experienceByRole");
    Objects.requireNonNull(hiddenAttrs, "hiddenAttrs");
    Objects.requireNonNull(hiredByTeamId, "hiredByTeamId");
    Objects.requireNonNull(scoutBranch, "scoutBranch");
  }

  /** Convenience "First Last" display form. */
  public String fullName() {
    return firstName + " " + lastName;
  }
}
