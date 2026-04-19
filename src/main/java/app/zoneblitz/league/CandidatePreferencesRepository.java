package app.zoneblitz.league;

import java.util.Optional;

/** Feature-internal persistence seam for {@link CandidatePreferences}. */
interface CandidatePreferencesRepository {

  /** Insert the preference row for a candidate. The candidate must already exist. */
  CandidatePreferences insert(CandidatePreferences preferences);

  /** Lookup preferences by candidate id; empty if the candidate has no preferences row yet. */
  Optional<CandidatePreferences> findByCandidateId(long candidateId);
}
