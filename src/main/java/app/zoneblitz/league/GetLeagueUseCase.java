package app.zoneblitz.league;

import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
class GetLeagueUseCase implements GetLeague {

  private final LeagueRepository repository;

  GetLeagueUseCase(LeagueRepository repository) {
    this.repository = repository;
  }

  @Override
  public Optional<LeagueSummary> get(long id, String ownerSubject) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");
    return repository.findSummaryByIdAndOwner(id, ownerSubject);
  }
}
