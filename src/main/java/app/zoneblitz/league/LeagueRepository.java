package app.zoneblitz.league;

import app.zoneblitz.league.phase.LeaguePhase;
import java.util.List;
import java.util.Optional;

public interface LeagueRepository {

  League insert(String ownerSubject, String name, LeaguePhase phase, LeagueSettings settings);

  boolean existsByOwnerAndName(String ownerSubject, String name);

  List<LeagueSummary> findSummariesFor(String ownerSubject);

  Optional<LeagueSummary> findSummaryByIdAndOwner(long id, String ownerSubject);

  Optional<League> findById(long id);

  /**
   * Update the phase and reset {@code phase_day} to 1.
   *
   * @return true if a row was updated, false if the league does not exist.
   */
  boolean updatePhaseAndResetDay(long id, LeaguePhase phase);

  /**
   * Increment {@code phase_day} by 1.
   *
   * @return the new {@code phase_day} value wrapped in {@link Optional}, or empty if the league
   *     does not exist.
   */
  Optional<Integer> incrementPhaseDay(long id);

  boolean deleteByIdAndOwner(long id, String ownerSubject);
}
