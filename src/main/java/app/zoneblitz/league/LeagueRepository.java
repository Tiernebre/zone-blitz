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
   * Update the phase and reset {@code phase_week} to 1.
   *
   * @return true if a row was updated, false if the league does not exist.
   */
  boolean updatePhaseAndResetWeek(long id, LeaguePhase phase);

  /**
   * Increment {@code phase_week} by 1.
   *
   * @return the new {@code phase_week} value wrapped in {@link Optional}, or empty if the league
   *     does not exist.
   */
  Optional<Integer> incrementPhaseWeek(long id);

  boolean deleteByIdAndOwner(long id, String ownerSubject);
}
