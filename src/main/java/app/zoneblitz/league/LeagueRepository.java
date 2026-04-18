package app.zoneblitz.league;

import java.util.List;
import java.util.Optional;

interface LeagueRepository {

  League insert(String ownerSubject, String name, LeaguePhase phase, LeagueSettings settings);

  boolean existsByOwnerAndName(String ownerSubject, String name);

  List<LeagueSummary> findSummariesFor(String ownerSubject);

  Optional<LeagueSummary> findSummaryByIdAndOwner(long id, String ownerSubject);
}
