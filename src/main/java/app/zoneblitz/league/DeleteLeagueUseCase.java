package app.zoneblitz.league;

import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class DeleteLeagueUseCase implements DeleteLeague {

  private final LeagueRepository leagues;

  DeleteLeagueUseCase(LeagueRepository leagues) {
    this.leagues = leagues;
  }

  @Override
  @Transactional
  public DeleteLeagueResult delete(long id, String ownerSubject) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");
    return leagues.deleteByIdAndOwner(id, ownerSubject)
        ? new DeleteLeagueResult.Deleted(id)
        : new DeleteLeagueResult.NotFound(id);
  }
}
