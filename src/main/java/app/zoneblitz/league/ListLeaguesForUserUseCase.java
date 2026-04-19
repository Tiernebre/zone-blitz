package app.zoneblitz.league;

import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class ListLeaguesForUserUseCase implements ListLeaguesForUser {

  private final LeagueRepository repository;

  public ListLeaguesForUserUseCase(LeagueRepository repository) {
    this.repository = repository;
  }

  @Override
  public List<LeagueSummary> listFor(String ownerSubject) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");
    return repository.findSummariesFor(ownerSubject);
  }
}
