package app.zoneblitz.league;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class ViewDirectorOfScoutingHiringUseCase implements ViewDirectorOfScoutingHiring {

  private final LeagueRepository leagues;
  private final CandidatePoolRepository pools;
  private final CandidateRepository candidates;
  private final CandidatePreferencesRepository preferences;
  private final TeamHiringStateRepository hiringStates;
  private final TeamInterviewRepository interviews;

  ViewDirectorOfScoutingHiringUseCase(
      LeagueRepository leagues,
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      TeamHiringStateRepository hiringStates,
      TeamInterviewRepository interviews) {
    this.leagues = leagues;
    this.pools = pools;
    this.candidates = candidates;
    this.preferences = preferences;
    this.hiringStates = hiringStates;
    this.interviews = interviews;
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<DirectorOfScoutingHiringView> view(long leagueId, String ownerSubject) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");
    var maybeLeague = leagues.findSummaryByIdAndOwner(leagueId, ownerSubject);
    if (maybeLeague.isEmpty()) {
      return Optional.empty();
    }
    var league = maybeLeague.get();
    if (league.phase() != LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING) {
      return Optional.empty();
    }
    var teamId = league.userTeamId();
    var phase = LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING;
    var pool =
        pools.findByLeaguePhaseAndType(leagueId, phase, CandidatePoolType.DIRECTOR_OF_SCOUTING);
    if (pool.isEmpty()) {
      return Optional.of(
          new DirectorOfScoutingHiringView(
              league, List.of(), List.of(), List.of(), 0, StartInterview.DEFAULT_WEEKLY_CAPACITY));
    }
    var rows = candidates.findAllByPoolId(pool.get().id());
    var prefs =
        rows.stream()
            .map(c -> preferences.findByCandidateId(c.id()))
            .flatMap(Optional::stream)
            .toList();
    var shortlist =
        hiringStates.find(teamId, phase).map(TeamHiringState::shortlist).orElse(List.of());
    var interviewHistory = interviews.findAllFor(teamId, phase);
    return Optional.of(
        DirectorOfScoutingHiringViewModel.assemble(
            league,
            rows,
            prefs,
            shortlist,
            interviewHistory,
            StartInterview.DEFAULT_WEEKLY_CAPACITY));
  }
}
