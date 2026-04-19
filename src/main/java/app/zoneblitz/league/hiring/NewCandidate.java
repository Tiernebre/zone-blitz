package app.zoneblitz.league.hiring;

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
    int age,
    int totalExperienceYears,
    String experienceByRole,
    String hiddenAttrs,
    String scoutedAttrs,
    Optional<ScoutBranch> scoutBranch) {

  public NewCandidate {
    Objects.requireNonNull(kind, "kind");
    Objects.requireNonNull(specialtyPosition, "specialtyPosition");
    Objects.requireNonNull(archetype, "archetype");
    Objects.requireNonNull(experienceByRole, "experienceByRole");
    Objects.requireNonNull(hiddenAttrs, "hiddenAttrs");
    Objects.requireNonNull(scoutedAttrs, "scoutedAttrs");
    Objects.requireNonNull(scoutBranch, "scoutBranch");
  }
}
