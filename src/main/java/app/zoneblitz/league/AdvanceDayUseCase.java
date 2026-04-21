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
public class AdvanceDayUseCase implements AdvanceDay {

  private static final Logger log = LoggerFactory.getLogger(AdvanceDayUseCase.class);

  private final LeagueRepository leagues;
  private final OfferResolver offerResolver;
  private final TeamLookup teams;
  private final HiringPhaseAutofill autofill;
  private final TeamHiringStateRepository hiringStates;
  private final AdvancePhase advancePhase;
  private final Map<LeaguePhase, CpuTeamStrategy> cpuStrategies;

  public AdvanceDayUseCase(
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
  public AdvanceDayResult advance(long leagueId, String ownerSubject) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");

    var maybeLeague = leagues.findSummaryByIdAndOwner(leagueId, ownerSubject);
    if (maybeLeague.isEmpty()) {
      return new AdvanceDayResult.NotFound(leagueId);
    }
    var league = maybeLeague.get();
    return tickOnce(leagueId, league.phase(), league.phaseDay(), ownerSubject);
  }

  @Override
  @Transactional
  public AdvanceDayResult tickKeepingPhase(long leagueId, String ownerSubject) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");

    var maybeLeague = leagues.findSummaryByIdAndOwner(leagueId, ownerSubject);
    if (maybeLeague.isEmpty()) {
      return new AdvanceDayResult.NotFound(leagueId);
    }
    var league = maybeLeague.get();
    var phase = league.phase();
    var phaseDay = league.phaseDay();

    runCpuStrategies(leagueId, phase, phaseDay);
    offerResolver.resolve(leagueId, phase, phaseDay);
    var newDay =
        leagues
            .incrementPhaseDay(leagueId)
            .orElseThrow(() -> new IllegalStateException("league disappeared mid-transaction"));
    log.info("league day advanced (phase kept) id={} phase={} day={}", leagueId, phase, newDay);
    return new AdvanceDayResult.Ticked(leagueId, phase, newDay, Optional.empty());
  }

  /**
   * Run a single day tick against the supplied phase/day state. Public within the package so {@code
   * HireCandidateUseCase} can fast-forward remaining days of a phase after a user hire.
   */
  @Transactional
  public AdvanceDayResult tickOnce(
      long leagueId, LeaguePhase phase, int phaseDay, String ownerSubject) {
    runCpuStrategies(leagueId, phase, phaseDay);

    // Offer resolution runs BEFORE phase_day increments so hires are recorded on the day the
    // offers were made. See docs/technical/league-phases.md (Ticks, OfferResolver).
    offerResolver.resolve(leagueId, phase, phaseDay);

    var newDay =
        leagues
            .incrementPhaseDay(leagueId)
            .orElseThrow(() -> new IllegalStateException("league disappeared mid-transaction"));

    var transitionedTo = maybeCompletePhase(leagueId, phase, phaseDay, ownerSubject);

    log.info("league day advanced id={} phase={} day={}", leagueId, phase, newDay);
    var phaseAfter = transitionedTo.orElse(phase);
    var dayAfter = transitionedTo.isPresent() ? 1 : newDay;
    return new AdvanceDayResult.Ticked(leagueId, phaseAfter, dayAfter, transitionedTo);
  }

  private Optional<LeaguePhase> maybeCompletePhase(
      long leagueId, LeaguePhase phase, int resolvedAtDay, String ownerSubject) {
    var shouldComplete = shouldComplete(leagueId, phase, resolvedAtDay);
    if (!shouldComplete) {
      return Optional.empty();
    }
    if (overCap(phase, resolvedAtDay)) {
      autofill.autofill(leagueId, phase, resolvedAtDay);
    }
    var advanced = advancePhase.advance(leagueId, ownerSubject);
    return switch (advanced) {
      case AdvancePhaseResult.Advanced a -> Optional.of(a.to());
      case AdvancePhaseResult.NoNextPhase ignored -> Optional.empty();
      case AdvancePhaseResult.NotFound ignored -> Optional.empty();
    };
  }

  private boolean shouldComplete(long leagueId, LeaguePhase phase, int resolvedAtDay) {
    return phase == LeaguePhase.INITIAL_SETUP
        || allTeamsHired(leagueId, phase)
        || overCap(phase, resolvedAtDay);
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
      case INITIAL_SETUP, EXPANSION_DRAFT_SCOUTING, ASSEMBLING_STAFF, COMPLETE -> false;
    };
  }

  private static boolean overCap(LeaguePhase phase, int resolvedAtDay) {
    return LeaguePhases.maxDays(phase).map(cap -> resolvedAtDay >= cap).orElse(false);
  }

  private void runCpuStrategies(long leagueId, LeaguePhase phase, int phaseDay) {
    var strategy = cpuStrategies.get(phase);
    if (strategy == null) {
      return;
    }
    for (var teamId : teams.cpuTeamIdsForLeague(leagueId)) {
      strategy.execute(leagueId, teamId, phaseDay);
    }
  }
}
