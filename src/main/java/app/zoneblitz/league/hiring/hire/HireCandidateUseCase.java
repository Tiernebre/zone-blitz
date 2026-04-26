package app.zoneblitz.league.hiring.hire;

import app.zoneblitz.league.AdvanceDay;
import app.zoneblitz.league.AdvanceDayResult;
import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.LeagueSummary;
import app.zoneblitz.league.hiring.CandidateOffer;
import app.zoneblitz.league.hiring.HireCandidate;
import app.zoneblitz.league.hiring.HireCandidateResult;
import app.zoneblitz.league.hiring.OfferStance;
import app.zoneblitz.league.hiring.OfferStatus;
import app.zoneblitz.league.hiring.candidates.CandidatePoolRepository;
import app.zoneblitz.league.hiring.candidates.CandidateRepository;
import app.zoneblitz.league.hiring.offer.CandidateOfferRepository;
import app.zoneblitz.league.hiring.offer.OfferTermsJson;
import app.zoneblitz.league.phase.HiringPhaseAutofill;
import app.zoneblitz.league.phase.HiringPhases;
import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.phase.LeaguePhases;
import app.zoneblitz.league.staff.NewTeamStaffMember;
import app.zoneblitz.league.staff.StaffRole;
import app.zoneblitz.league.staff.TeamStaffMember;
import app.zoneblitz.league.staff.TeamStaffRepository;
import app.zoneblitz.league.team.TeamHiringState;
import app.zoneblitz.league.team.TeamHiringStateRepository;
import app.zoneblitz.league.team.TeamLookup;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class HireCandidateUseCase implements HireCandidate {

  private static final Logger log = LoggerFactory.getLogger(HireCandidateUseCase.class);

  private final LeagueRepository leagues;
  private final CandidatePoolRepository pools;
  private final CandidateRepository candidates;
  private final CandidateOfferRepository offers;
  private final TeamHiringStateRepository hiringStates;
  private final TeamStaffRepository staff;
  private final StaffContractRepository staffContracts;
  private final AdvanceDay advanceDay;
  private final TeamLookup teams;
  private final HiringPhaseAutofill autofill;

  public HireCandidateUseCase(
      LeagueRepository leagues,
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidateOfferRepository offers,
      TeamHiringStateRepository hiringStates,
      TeamStaffRepository staff,
      StaffContractRepository staffContracts,
      AdvanceDay advanceDay,
      TeamLookup teams,
      HiringPhaseAutofill autofill) {
    this.leagues = leagues;
    this.pools = pools;
    this.candidates = candidates;
    this.offers = offers;
    this.hiringStates = hiringStates;
    this.staff = staff;
    this.staffContracts = staffContracts;
    this.advanceDay = advanceDay;
    this.teams = teams;
    this.autofill = autofill;
  }

  @Override
  @Transactional
  public HireCandidateResult hire(long leagueId, long candidateId, String ownerSubject) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");
    var maybeLeague = leagues.findSummaryByIdAndOwner(leagueId, ownerSubject);
    if (maybeLeague.isEmpty()) {
      return new HireCandidateResult.NotFound(leagueId);
    }
    var league = maybeLeague.get();
    var phase = league.phase();
    var poolType = HiringPhases.poolTypeFor(phase);
    if (poolType.isEmpty()) {
      return new HireCandidateResult.NotFound(leagueId);
    }
    var pool = pools.findByLeaguePhaseAndType(leagueId, phase, poolType.get());
    if (pool.isEmpty()) {
      return new HireCandidateResult.UnknownCandidate(candidateId);
    }
    var candidate = candidates.findById(candidateId);
    if (candidate.isEmpty() || candidate.get().poolId() != pool.get().id()) {
      return new HireCandidateResult.UnknownCandidate(candidateId);
    }
    if (candidate.get().hiredByTeamId().isPresent()) {
      return new HireCandidateResult.AlreadyHired(candidate.get().hiredByTeamId().get());
    }

    var teamId = league.userTeamId();
    var offer = offers.findActiveForTeamAndCandidate(teamId, candidateId);
    if (offer.isEmpty() || offer.get().stance().orElse(null) != OfferStance.AGREED) {
      return new HireCandidateResult.NoAgreedOffer(candidateId);
    }

    candidates.markHired(candidateId, teamId);
    offers.resolve(offer.get().id(), OfferStatus.ACCEPTED);
    for (var other : offers.findActiveForCandidate(candidateId)) {
      offers.resolve(other.id(), OfferStatus.REJECTED);
    }
    for (var stale : offers.findOutstandingForTeam(teamId)) {
      offers.resolve(stale.id(), OfferStatus.REJECTED);
    }
    upsertHired(teamId, phase, candidateId, league.phaseDay(), offer.get(), league);
    log.info(
        "user hire leagueId={} teamId={} candidateId={} offerId={} day={}",
        leagueId,
        teamId,
        candidateId,
        offer.get().id(),
        league.phaseDay());
    fastForwardWithinPhase(leagueId, phase, ownerSubject);
    return new HireCandidateResult.Hired(candidateId, teamId);
  }

  /**
   * After the user's hire, run day ticks without advancing the phase — CPU teams still need to
   * finish their own hires, but we deliberately stop short of the phase transition so the user
   * lands on the summary page for this hiring phase rather than being silently advanced past it.
   * Loop terminates when every team has reached {@link HiringStep#HIRED} or the phase cap is
   * exhausted; any team still unresolved at that point is force-hired via {@link
   * HiringPhaseAutofill} so the summary page is never left with stale "Open" seats.
   */
  private void fastForwardWithinPhase(long leagueId, LeaguePhase entryPhase, String ownerSubject) {
    var maxIterations = LeaguePhases.maxDays(entryPhase).orElse(0) + 1;
    for (var i = 0; i < maxIterations; i++) {
      if (allTeamsHired(leagueId, entryPhase)) {
        return;
      }
      var result = advanceDay.tickKeepingPhase(leagueId, ownerSubject);
      if (!(result instanceof AdvanceDayResult.Ticked)) {
        return;
      }
    }
    if (!allTeamsHired(leagueId, entryPhase)) {
      var phaseDay =
          leagues.findSummaryByIdAndOwner(leagueId, ownerSubject).map(l -> l.phaseDay()).orElse(1);
      autofill.autofill(leagueId, entryPhase, phaseDay);
    }
  }

  private boolean allTeamsHired(long leagueId, LeaguePhase phase) {
    var teamIds = teams.teamIdsForLeague(leagueId);
    if (teamIds.isEmpty()) {
      return false;
    }
    for (var teamId : teamIds) {
      var state = hiringStates.find(teamId, phase);
      if (state.isEmpty() || state.get().step() != HiringStep.HIRED) {
        return false;
      }
    }
    return true;
  }

  private void upsertHired(
      long teamId,
      LeaguePhase phase,
      long candidateId,
      int dayAtResolve,
      CandidateOffer offer,
      LeagueSummary league) {
    var existing = hiringStates.find(teamId, phase);
    hiringStates.upsert(
        new TeamHiringState(
            existing.map(TeamHiringState::id).orElse(0L),
            teamId,
            phase,
            HiringStep.HIRED,
            existing.map(TeamHiringState::interviewingCandidateIds).orElse(List.of())));
    TeamStaffMember staffMember =
        staff.insert(
            new NewTeamStaffMember(
                teamId, candidateId, staffRoleFor(phase), Optional.empty(), phase, dayAtResolve));
    var terms = OfferTermsJson.fromJson(offer.terms());
    var contract =
        StaffContractFactory.fromTerms(
            teamId, candidateId, staffMember.id(), terms, league.season());
    staffContracts.insert(contract);
  }

  private static StaffRole staffRoleFor(LeaguePhase phase) {
    return switch (phase) {
      case HIRING_HEAD_COACH -> StaffRole.HEAD_COACH;
      case HIRING_DIRECTOR_OF_SCOUTING -> StaffRole.DIRECTOR_OF_SCOUTING;
      case INITIAL_SETUP, EXPANSION_DRAFT_SCOUTING, ASSEMBLING_STAFF, COMPLETE ->
          throw new IllegalStateException("no staff role for non-hiring phase " + phase);
    };
  }
}
