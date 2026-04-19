package app.zoneblitz.league;

import java.util.Objects;
import java.util.Optional;

/**
 * A single candidate in a {@link CandidatePool}.
 *
 * <p>JSONB payloads ({@code experienceByRole}, {@code hiddenAttrs}, {@code scoutedAttrs}) are
 * carried as raw JSON strings at this layer; the generator and consumers parse them into typed
 * structures. {@code hiredByFranchiseId} and {@code scoutBranch} are optional because they are
 * populated later in the candidate's lifecycle (on hire) or only for scout candidates.
 *
 * @param experienceByRole JSON object mapping role name to years, e.g. {@code {"OC": 10, "HC": 0}}.
 * @param hiddenAttrs the never-revealed true-rating attribute payload. Must not be surfaced to UI.
 * @param scoutedAttrs the noised estimate shown to franchises.
 */
public record Candidate(
    long id,
    long poolId,
    CandidateKind kind,
    SpecialtyPosition specialtyPosition,
    CandidateArchetype archetype,
    int age,
    int totalExperienceYears,
    String experienceByRole,
    String hiddenAttrs,
    String scoutedAttrs,
    Optional<Long> hiredByFranchiseId,
    Optional<ScoutBranch> scoutBranch) {

  public Candidate {
    Objects.requireNonNull(kind, "kind");
    Objects.requireNonNull(specialtyPosition, "specialtyPosition");
    Objects.requireNonNull(archetype, "archetype");
    Objects.requireNonNull(experienceByRole, "experienceByRole");
    Objects.requireNonNull(hiddenAttrs, "hiddenAttrs");
    Objects.requireNonNull(scoutedAttrs, "scoutedAttrs");
    Objects.requireNonNull(hiredByFranchiseId, "hiredByFranchiseId");
    Objects.requireNonNull(scoutBranch, "scoutBranch");
  }
}
