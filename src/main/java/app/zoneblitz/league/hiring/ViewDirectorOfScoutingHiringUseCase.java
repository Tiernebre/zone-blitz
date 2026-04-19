package app.zoneblitz.league.hiring;

import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.team.TeamProfiles;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ViewDirectorOfScoutingHiringUseCase implements ViewDirectorOfScoutingHiring {

  private final LeagueRepository leagues;
  private final CandidatePoolRepository pools;
  private final CandidateRepository candidates;
  private final CandidatePreferencesRepository preferences;
  private final TeamInterviewRepository interviews;
  private final CandidateOfferRepository offers;
  private final TeamProfiles teamProfiles;

  public ViewDirectorOfScoutingHiringUseCase(
      LeagueRepository leagues,
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      TeamInterviewRepository interviews,
      CandidateOfferRepository offers,
      TeamProfiles teamProfiles) {
    this.leagues = leagues;
    this.pools = pools;
    this.candidates = candidates;
    this.preferences = preferences;
    this.interviews = interviews;
    this.offers = offers;
    this.teamProfiles = teamProfiles;
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
              league, List.of(), List.of(), 0, StartInterview.DAILY_CAPACITY));
    }
    var rows = candidates.findAllByPoolId(pool.get().id());
    var prefs =
        rows.stream()
            .map(c -> preferences.findByCandidateId(c.id()))
            .flatMap(Optional::stream)
            .toList();
    var interviewHistory = interviews.findAllFor(teamId, phase);
    var teamOffers = offers.findActiveForTeam(teamId);
    var profile = teamProfiles.forTeam(teamId);
    return Optional.of(
        DirectorOfScoutingHiringViewModel.assemble(
            league,
            rows,
            prefs,
            interviewHistory,
            teamOffers,
            profile,
            StartInterview.DAILY_CAPACITY));
  }
}
