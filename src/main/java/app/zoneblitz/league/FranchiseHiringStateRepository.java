package app.zoneblitz.league;

import java.util.List;
import java.util.Optional;

/** Feature-internal persistence seam for {@link FranchiseHiringState}. */
interface FranchiseHiringStateRepository {

  /**
   * Insert or replace the hiring state for a {@code (league, franchise, phase)} triple. Returns the
   * upserted row.
   */
  FranchiseHiringState upsert(FranchiseHiringState state);

  Optional<FranchiseHiringState> find(long leagueId, long franchiseId, LeaguePhase phase);

  List<FranchiseHiringState> findAllForLeaguePhase(long leagueId, LeaguePhase phase);
}
