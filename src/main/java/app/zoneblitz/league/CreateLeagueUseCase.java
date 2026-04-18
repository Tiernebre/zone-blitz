package app.zoneblitz.league;

import java.util.ArrayList;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class CreateLeagueUseCase implements CreateLeague {

  private final LeagueRepository leagues;
  private final FranchiseRepository franchises;
  private final TeamRepository teams;

  CreateLeagueUseCase(
      LeagueRepository leagues, FranchiseRepository franchises, TeamRepository teams) {
    this.leagues = leagues;
    this.franchises = franchises;
    this.teams = teams;
  }

  @Override
  @Transactional
  public CreateLeagueResult create(String ownerSubject, String name, long franchiseId) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");
    Objects.requireNonNull(name, "name");
    var trimmed = name.trim();

    if (franchises.findById(franchiseId).isEmpty()) {
      return new CreateLeagueResult.UnknownFranchise(franchiseId);
    }
    if (leagues.existsByOwnerAndName(ownerSubject, trimmed)) {
      return new CreateLeagueResult.NameTaken(trimmed);
    }

    var settings = LeagueSettings.defaults();
    var league = leagues.insert(ownerSubject, trimmed, LeaguePhase.INITIAL_SETUP, settings);

    var drafts = new ArrayList<TeamDraft>();
    drafts.add(new TeamDraft(franchiseId, Optional.of(ownerSubject)));
    for (var other : franchises.listAll()) {
      if (other.id() != franchiseId) {
        drafts.add(new TeamDraft(other.id(), Optional.empty()));
      }
    }
    teams.insertAll(league.id(), drafts);

    return new CreateLeagueResult.Created(league);
  }
}
