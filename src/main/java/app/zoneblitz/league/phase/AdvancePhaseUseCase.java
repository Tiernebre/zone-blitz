package app.zoneblitz.league.phase;

import app.zoneblitz.league.LeagueRepository;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdvancePhaseUseCase implements AdvancePhase {

  private static final Logger log = LoggerFactory.getLogger(AdvancePhaseUseCase.class);

  private final LeagueRepository leagues;
  private final Map<LeaguePhase, PhaseTransitionHandler> handlers;

  public AdvancePhaseUseCase(LeagueRepository leagues, List<PhaseTransitionHandler> handlers) {
    this.leagues = leagues;
    this.handlers =
        handlers.stream()
            .collect(Collectors.toUnmodifiableMap(PhaseTransitionHandler::phase, h -> h));
  }

  @Override
  @Transactional
  public AdvancePhaseResult advance(long leagueId, String ownerSubject) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");

    var maybeLeague = leagues.findSummaryByIdAndOwner(leagueId, ownerSubject);
    if (maybeLeague.isEmpty()) {
      return new AdvancePhaseResult.NotFound(leagueId);
    }
    var current = maybeLeague.get().phase();
    var maybeNext = LeaguePhases.next(current);
    if (maybeNext.isEmpty()) {
      return new AdvancePhaseResult.NoNextPhase(leagueId, current);
    }
    var next = maybeNext.get();

    var exitHandler = handlers.get(current);
    if (exitHandler != null) {
      exitHandler.onExit(leagueId);
    }
    leagues.updatePhaseAndResetWeek(leagueId, next);
    var entryHandler = handlers.get(next);
    if (entryHandler != null) {
      entryHandler.onEntry(leagueId);
    }

    log.info("league phase advanced id={} from={} to={}", leagueId, current, next);
    return new AdvancePhaseResult.Advanced(leagueId, current, next);
  }
}
