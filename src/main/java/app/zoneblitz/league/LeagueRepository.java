package app.zoneblitz.league;

import java.util.List;

interface LeagueRepository {

  League insert(String ownerSubject, String name, LeaguePhase phase, LeagueSettings settings);

  boolean existsByOwnerAndName(String ownerSubject, String name);

  List<LeagueSummary> findSummariesFor(String ownerSubject);
}
