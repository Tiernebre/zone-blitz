package app.zoneblitz.league.hiring;

import app.zoneblitz.league.AdvanceDay;
import app.zoneblitz.league.AdvanceDayResult;
import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.phase.HiringPhases;
import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.phase.LeaguePhases;
import app.zoneblitz.league.staff.NewTeamStaffMember;
import app.zoneblitz.league.staff.StaffRole;
import app.zoneblitz.league.staff.TeamStaffRepository;
import app.zoneblitz.league.team.TeamHiringState;
import app.zoneblitz.league.team.TeamHiringStateRepository;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HireCandidateUseCase implements HireCandidate {

  private static final Logger log = LoggerFactory.getLogger(HireCandidateUseCase.class);

  private final LeagueRepository leagues;
  private final CandidatePoolRepository pools;
  private final CandidateRepository candidates;
  private final CandidateOfferRepository offers;
  private final TeamHiringStateRepository hiringStates;
  private final TeamStaffRepository staff;
  private final AdvanceDay advanceDay;

  public HireCandidateUseCase(
      LeagueRepository leagues,
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidateOfferRepository offers,
      TeamHiringStateRepository hiringStates,
      TeamStaffRepository staff,
      AdvanceDay advanceDay) {
    this.leagues = leagues;
    this.pools = pools;
    this.candidates = candidates;
    this.offers = offers;
    this.hiringStates = hiringStates;
    this.staff = staff;
    this.advanceDay = advanceDay;
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
    upsertHired(teamId, phase, candidateId, league.phaseDay());
    log.info(
        "user hire leagueId={} teamId={} candidateId={} offerId={} day={}",
        leagueId,
        teamId,
        candidateId,
        offer.get().id(),
        league.phaseDay());
    fastForwardToNextPhase(leagueId, phase, ownerSubject);
    return new HireCandidateResult.Hired(candidateId, teamId);
  }

  /**
   * After the user's hire, run day ticks until the phase transitions. The remaining in-phase days
   * are dead time for the user once their only seat is filled — CPU teams still need to finish
   * their own hires, so we advance day-by-day (running CPU strategies + the resolver each tick)
   * until the phase cap hits and autofill transitions us, or every team has resolved.
   */
  private void fastForwardToNextPhase(long leagueId, LeaguePhase entryPhase, String ownerSubject) {
    var maxIterations = LeaguePhases.maxDays(entryPhase).orElse(0) + 1;
    for (var i = 0; i < maxIterations; i++) {
      var result = advanceDay.advance(leagueId, ownerSubject);
      if (!(result instanceof AdvanceDayResult.Ticked ticked)) {
        return;
      }
      if (ticked.transitionedTo().isPresent() || ticked.phase() != entryPhase) {
        return;
      }
    }
  }

  private void upsertHired(long teamId, LeaguePhase phase, long candidateId, int dayAtResolve) {
    var existing = hiringStates.find(teamId, phase);
    hiringStates.upsert(
        new TeamHiringState(
            existing.map(TeamHiringState::id).orElse(0L),
            teamId,
            phase,
            HiringStep.HIRED,
            existing.map(TeamHiringState::interviewingCandidateIds).orElse(List.of())));
    staff.insert(
        new NewTeamStaffMember(
            teamId, candidateId, staffRoleFor(phase), Optional.empty(), phase, dayAtResolve));
  }

  private static StaffRole staffRoleFor(LeaguePhase phase) {
    return switch (phase) {
      case HIRING_HEAD_COACH -> StaffRole.HEAD_COACH;
      case HIRING_DIRECTOR_OF_SCOUTING -> StaffRole.DIRECTOR_OF_SCOUTING;
      case INITIAL_SETUP, ASSEMBLING_STAFF, COMPLETE ->
          throw new IllegalStateException("no staff role for non-hiring phase " + phase);
    };
  }
}
