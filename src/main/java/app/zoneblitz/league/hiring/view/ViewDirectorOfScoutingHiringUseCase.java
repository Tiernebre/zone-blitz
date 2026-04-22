package app.zoneblitz.league.hiring.view;

import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.hiring.CandidateOffer;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.OfferStatus;
import app.zoneblitz.league.hiring.StartInterview;
import app.zoneblitz.league.hiring.candidates.CandidatePoolRepository;
import app.zoneblitz.league.hiring.candidates.CandidatePreferencesRepository;
import app.zoneblitz.league.hiring.candidates.CandidateRepository;
import app.zoneblitz.league.hiring.hire.LeagueHires;
import app.zoneblitz.league.hiring.hire.StaffBudgetRepository;
import app.zoneblitz.league.hiring.interview.TeamInterviewRepository;
import app.zoneblitz.league.hiring.offer.CandidateOfferRepository;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.team.TeamProfiles;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
  private final TeamInterviewRepository interviews;
  private final CandidateOfferRepository offers;
  private final TeamProfiles teamProfiles;
  private final LeagueHires leagueHires;
  private final StaffBudgetRepository budgets;

  public ViewDirectorOfScoutingHiringUseCase(
      LeagueRepository leagues,
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      TeamInterviewRepository interviews,
      CandidateOfferRepository offers,
      TeamProfiles teamProfiles,
      LeagueHires leagueHires,
      StaffBudgetRepository budgets) {
    this.leagues = leagues;
    this.pools = pools;
    this.candidates = candidates;
    this.preferences = preferences;
    this.interviews = interviews;
    this.offers = offers;
    this.teamProfiles = teamProfiles;
    this.leagueHires = leagueHires;
    this.budgets = budgets;
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
    var budget = budgets.committed(teamId, league.season());
    var pool =
        pools.findByLeaguePhaseAndType(leagueId, phase, CandidatePoolType.DIRECTOR_OF_SCOUTING);
    if (pool.isEmpty()) {
      return Optional.of(
          new DirectorOfScoutingHiringView(
              league, List.of(), List.of(), List.of(), 0, StartInterview.DAILY_CAPACITY, budget));
    }
    var rows = candidates.findAllByPoolId(pool.get().id());
    var prefs =
        rows.stream()
            .map(c -> preferences.findByCandidateId(c.id()))
            .flatMap(Optional::stream)
            .toList();
    var interviewHistory = interviews.findAllFor(teamId, phase);
    var teamOffers = offers.findOutstandingForTeam(teamId);
    var competingOffersById = resolveCompetingOffers(teamOffers);
    var profile = teamProfiles.forTeam(teamId);
    var board = leagueHires.forLeaguePool(leagueId, teamId, pool.get().id());
    return Optional.of(
        DirectorOfScoutingHiringViewModel.assemble(
            league,
            rows,
            prefs,
            interviewHistory,
            teamOffers,
            profile,
            board,
            StartInterview.DAILY_CAPACITY,
            budget,
            league.phaseDay(),
            competingOffersById));
  }

  private Map<Long, CandidateOffer> resolveCompetingOffers(List<CandidateOffer> teamOffers) {
    Map<Long, CandidateOffer> byId = new HashMap<>();
    for (var offer : teamOffers) {
      if (offer.status() == OfferStatus.COUNTER_PENDING && offer.competingOfferId().isPresent()) {
        var competingId = offer.competingOfferId().get();
        if (!byId.containsKey(competingId)) {
          offers.findById(competingId).ifPresent(c -> byId.put(competingId, c));
        }
      }
    }
    return byId;
  }
}
