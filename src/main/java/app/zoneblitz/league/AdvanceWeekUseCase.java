package app.zoneblitz.league;

import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class AdvanceWeekUseCase implements AdvanceWeek {

  private static final Logger log = LoggerFactory.getLogger(AdvanceWeekUseCase.class);

  private final LeagueRepository leagues;

  AdvanceWeekUseCase(LeagueRepository leagues) {
    this.leagues = leagues;
  }

  @Override
  @Transactional
  public AdvanceWeekResult advance(long leagueId, String ownerSubject) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");

    var maybeLeague = leagues.findSummaryByIdAndOwner(leagueId, ownerSubject);
    if (maybeLeague.isEmpty()) {
      return new AdvanceWeekResult.NotFound(leagueId);
    }
    var phase = maybeLeague.get().phase();

    // CPU franchise strategies are a future seam (see docs/technical/league-phases.md). No
    // phase defines a completion rule yet, so the tick is currently just "increment the counter".
    var newWeek =
        leagues
            .incrementPhaseWeek(leagueId)
            .orElseThrow(() -> new IllegalStateException("league disappeared mid-transaction"));

    log.info("league week advanced id={} phase={} week={}", leagueId, phase, newWeek);
    return new AdvanceWeekResult.Ticked(leagueId, phase, newWeek, Optional.empty());
  }
}
