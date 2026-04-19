package app.zoneblitz.league.team;

import app.zoneblitz.league.phase.LeaguePhase;
import java.util.List;
import java.util.Optional;

/** Feature-internal persistence seam for {@link TeamHiringState}. */
public interface TeamHiringStateRepository {

  /**
   * Insert or replace the hiring state for a {@code (team, phase)} pair. Returns the upserted row.
   */
  TeamHiringState upsert(TeamHiringState state);

  Optional<TeamHiringState> find(long teamId, LeaguePhase phase);

  List<TeamHiringState> findAllForLeaguePhase(long leagueId, LeaguePhase phase);
}
