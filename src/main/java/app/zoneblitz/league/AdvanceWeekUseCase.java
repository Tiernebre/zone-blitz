package app.zoneblitz.league;

import app.zoneblitz.league.hiring.OfferResolver;
import app.zoneblitz.league.phase.AdvancePhase;
import app.zoneblitz.league.phase.AdvancePhaseResult;
import app.zoneblitz.league.phase.HiringPhaseAutofill;
import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.phase.LeaguePhases;
import app.zoneblitz.league.team.CpuTeamStrategy;
import app.zoneblitz.league.team.TeamHiringStateRepository;
import app.zoneblitz.league.team.TeamLookup;
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
public class AdvanceWeekUseCase implements AdvanceWeek {

  private static final Logger log = LoggerFactory.getLogger(AdvanceWeekUseCase.class);

  private final LeagueRepository leagues;
  private final OfferResolver offerResolver;
  private final TeamLookup teams;
  private final HiringPhaseAutofill autofill;
  private final TeamHiringStateRepository hiringStates;
  private final AdvancePhase advancePhase;
  private final Map<LeaguePhase, CpuTeamStrategy> cpuStrategies;

  public AdvanceWeekUseCase(
      LeagueRepository leagues,
      OfferResolver offerResolver,
      TeamLookup teams,
      HiringPhaseAutofill autofill,
      TeamHiringStateRepository hiringStates,
      AdvancePhase advancePhase,
      List<CpuTeamStrategy> cpuStrategies) {
    this.leagues = leagues;
    this.offerResolver = offerResolver;
    this.teams = teams;
    this.autofill = autofill;
    this.hiringStates = hiringStates;
    this.advancePhase = advancePhase;
    this.cpuStrategies =
        cpuStrategies.stream()
            .collect(Collectors.toUnmodifiableMap(CpuTeamStrategy::phase, s -> s));
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

    var transitionedTo = maybeCompletePhase(leagueId, phase, phaseWeek, ownerSubject);

    log.info("league week advanced id={} phase={} week={}", leagueId, phase, newWeek);
    var phaseAfter = transitionedTo.orElse(phase);
    var weekAfter = transitionedTo.isPresent() ? 1 : newWeek;
    return new AdvanceWeekResult.Ticked(leagueId, phaseAfter, weekAfter, transitionedTo);
  }

  private Optional<LeaguePhase> maybeCompletePhase(
      long leagueId, LeaguePhase phase, int resolvedAtWeek, String ownerSubject) {
    var shouldComplete = shouldComplete(leagueId, phase, resolvedAtWeek);
    if (!shouldComplete) {
      return Optional.empty();
    }
    if (overCap(phase, resolvedAtWeek)) {
      autofill.autofill(leagueId, phase, resolvedAtWeek);
    }
    var advanced = advancePhase.advance(leagueId, ownerSubject);
    return switch (advanced) {
      case AdvancePhaseResult.Advanced a -> Optional.of(a.to());
      case AdvancePhaseResult.NoNextPhase ignored -> Optional.empty();
      case AdvancePhaseResult.NotFound ignored -> Optional.empty();
    };
  }

  private boolean shouldComplete(long leagueId, LeaguePhase phase, int resolvedAtWeek) {
    return allTeamsHired(leagueId, phase) || overCap(phase, resolvedAtWeek);
  }

  private boolean allTeamsHired(long leagueId, LeaguePhase phase) {
    return switch (phase) {
      case HIRING_HEAD_COACH, HIRING_DIRECTOR_OF_SCOUTING -> {
        var teamIds = teams.teamIdsForLeague(leagueId);
        if (teamIds.isEmpty()) {
          yield false;
        }
        for (var teamId : teamIds) {
          var state = hiringStates.find(teamId, phase);
          if (state.isEmpty() || state.get().step() != HiringStep.HIRED) {
            yield false;
          }
        }
        yield true;
      }
      case INITIAL_SETUP, ASSEMBLING_STAFF, COMPLETE -> false;
    };
  }

  private static boolean overCap(LeaguePhase phase, int resolvedAtWeek) {
    return LeaguePhases.maxWeeks(phase).map(cap -> resolvedAtWeek >= cap).orElse(false);
  }

  private void runCpuStrategies(long leagueId, LeaguePhase phase, int phaseWeek) {
    var strategy = cpuStrategies.get(phase);
    if (strategy == null) {
      return;
    }
    for (var teamId : teams.cpuTeamIdsForLeague(leagueId)) {
      strategy.execute(leagueId, teamId, phaseWeek);
    }
  }
}
