package app.zoneblitz.league.hiring;

import app.zoneblitz.league.hiring.candidates.CandidateRepository;
import app.zoneblitz.league.staff.SpecialtyPosition;
import java.util.Objects;
import java.util.Optional;

/**
 * Insert-side DTO for {@link CandidateRepository#insert(NewCandidate)}. Kept separate from {@link
 * Candidate} so the repository does not have to invent a sentinel id before insert.
 */
public record NewCandidate(
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
    Optional<ScoutBranch> scoutBranch) {

  public NewCandidate {
    Objects.requireNonNull(kind, "kind");
    Objects.requireNonNull(specialtyPosition, "specialtyPosition");
    Objects.requireNonNull(archetype, "archetype");
    Objects.requireNonNull(firstName, "firstName");
    Objects.requireNonNull(lastName, "lastName");
    Objects.requireNonNull(experienceByRole, "experienceByRole");
    Objects.requireNonNull(hiddenAttrs, "hiddenAttrs");
    Objects.requireNonNull(scoutBranch, "scoutBranch");
  }
}
