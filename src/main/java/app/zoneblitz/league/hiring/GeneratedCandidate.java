package app.zoneblitz.league.hiring;

import java.util.Objects;

/**
 * Output of a {@link CandidateGenerator}. Bundles the insert-side candidate payload with the paired
 * preferences draft so callers can persist both in one transaction. The preferences draft carries
 * every dimension except {@code candidateId} — that is materialized once the candidate row exists.
 */
public record GeneratedCandidate(NewCandidate candidate, CandidatePreferencesDraft preferences) {

  public GeneratedCandidate {
    Objects.requireNonNull(candidate, "candidate");
    Objects.requireNonNull(preferences, "preferences");
  }
}
