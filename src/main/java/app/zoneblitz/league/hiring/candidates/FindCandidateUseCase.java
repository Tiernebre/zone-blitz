package app.zoneblitz.league.hiring.candidates;

import app.zoneblitz.league.hiring.Candidate;
import app.zoneblitz.league.hiring.FindCandidate;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
class FindCandidateUseCase implements FindCandidate {

  private final CandidateRepository candidates;

  FindCandidateUseCase(CandidateRepository candidates) {
    this.candidates = candidates;
  }

  @Override
  public Optional<Candidate> findById(long candidateId) {
    return candidates.findById(candidateId);
  }
}
