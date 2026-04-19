package app.zoneblitz.league;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class AdvanceWeekUseCase implements AdvanceWeek {

  private static final Logger log = LoggerFactory.getLogger(AdvanceWeekUseCase.class);

  private final LeagueRepository leagues;
  private final OfferResolver offerResolver;
  private final TeamLookup teams;
  private final Map<LeaguePhase, CpuFranchiseStrategy> cpuStrategies;

  AdvanceWeekUseCase(
      LeagueRepository leagues,
      OfferResolver offerResolver,
      TeamLookup teams,
      List<CpuFranchiseStrategy> cpuStrategies) {
    this.leagues = leagues;
    this.offerResolver = offerResolver;
    this.teams = teams;
    this.cpuStrategies =
        cpuStrategies.stream()
            .collect(Collectors.toUnmodifiableMap(CpuFranchiseStrategy::phase, s -> s));
  }

  @Override
  @Transactional
  public AdvanceWeekResult advance(long leagueId, String ownerSubject) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");

    var maybeLeague = leagues.findSummaryByIdAndOwner(leagueId, ownerSubject);
    if (maybeLeague.isEmpty()) {
      return new AdvanceWeekResult.NotFound(leagueId);
    }
    var league = maybeLeague.get();
    var phase = league.phase();
    var phaseWeek = league.phaseWeek();

    runCpuStrategies(leagueId, phase, phaseWeek);

    // Offer resolution runs BEFORE phase_week increments so hires are recorded on the week the
    // offers were made. See docs/technical/league-phases.md (Ticks, OfferResolver).
    offerResolver.resolve(leagueId, phase, phaseWeek);

    var newWeek =
        leagues
            .incrementPhaseWeek(leagueId)
            .orElseThrow(() -> new IllegalStateException("league disappeared mid-transaction"));

    log.info("league week advanced id={} phase={} week={}", leagueId, phase, newWeek);
    return new AdvanceWeekResult.Ticked(leagueId, phase, newWeek, Optional.empty());
  }

  private void runCpuStrategies(long leagueId, LeaguePhase phase, int phaseWeek) {
    var strategy = cpuStrategies.get(phase);
    if (strategy == null) {
      return;
    }
    for (var franchiseId : teams.cpuFranchiseIdsForLeague(leagueId)) {
      strategy.execute(leagueId, franchiseId, phaseWeek);
    }
  }
}
