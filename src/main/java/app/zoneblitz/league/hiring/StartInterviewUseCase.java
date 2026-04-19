package app.zoneblitz.league.hiring;

import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.phase.HiringPhases;
import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.team.TeamHiringState;
import app.zoneblitz.league.team.TeamHiringStateRepository;
import app.zoneblitz.league.team.TeamProfiles;
import java.util.ArrayList;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StartInterviewUseCase implements StartInterview {

  private static final Logger log = LoggerFactory.getLogger(StartInterviewUseCase.class);

  private final LeagueRepository leagues;
  private final CandidatePoolRepository pools;
  private final CandidateRepository candidates;
  private final CandidatePreferencesRepository preferences;
  private final TeamHiringStateRepository hiringStates;
  private final TeamInterviewRepository interviews;
  private final TeamProfiles teamProfiles;

  public StartInterviewUseCase(
      LeagueRepository leagues,
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      TeamHiringStateRepository hiringStates,
      TeamInterviewRepository interviews,
      TeamProfiles teamProfiles) {
    this.leagues = leagues;
    this.pools = pools;
    this.candidates = candidates;
    this.preferences = preferences;
    this.hiringStates = hiringStates;
    this.interviews = interviews;
    this.teamProfiles = teamProfiles;
  }

  @Override
  @Transactional
  public InterviewResult start(long leagueId, long candidateId, String ownerSubject) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");
    var maybeLeague = leagues.findSummaryByIdAndOwner(leagueId, ownerSubject);
    if (maybeLeague.isEmpty()) {
      return new InterviewResult.NotFound(leagueId);
    }
    var league = maybeLeague.get();
    var phase = league.phase();
    var poolType = HiringPhases.poolTypeFor(phase);
    if (poolType.isEmpty()) {
      return new InterviewResult.NotFound(leagueId);
    }
    var maybePool = pools.findByLeaguePhaseAndType(leagueId, phase, poolType.get());
    if (maybePool.isEmpty()) {
      return new InterviewResult.NotFound(leagueId);
    }
    var maybeCandidate = candidates.findById(candidateId);
    if (maybeCandidate.isEmpty() || maybeCandidate.get().poolId() != maybePool.get().id()) {
      return new InterviewResult.UnknownCandidate(candidateId);
    }
    var teamId = league.userTeamId();
    var phaseWeek = league.phaseWeek();

    if (interviews.countForCandidate(teamId, candidateId, phase) > 0) {
      return new InterviewResult.AlreadyInterviewed(candidateId);
    }

    var weekCount = interviews.countForWeek(teamId, phase, phaseWeek);
    if (weekCount >= DEFAULT_WEEKLY_CAPACITY) {
      return new InterviewResult.CapacityReached(DEFAULT_WEEKLY_CAPACITY);
    }

    var maybePrefs = preferences.findByCandidateId(candidateId);
    if (maybePrefs.isEmpty()) {
      return new InterviewResult.UnknownCandidate(candidateId);
    }
    var maybeProfile = teamProfiles.forTeam(teamId);
    if (maybeProfile.isEmpty()) {
      return new InterviewResult.NotFound(leagueId);
    }
    var interest = InterestScoring.score(maybeProfile.get(), maybePrefs.get());

    interviews.insert(new NewTeamInterview(teamId, candidateId, phase, phaseWeek, 1, interest));
    appendToHiringState(teamId, candidateId, phase);

    var pool = candidates.findAllByPoolId(maybePool.get().id());
    var prefs =
        pool.stream()
            .map(c -> preferences.findByCandidateId(c.id()))
            .flatMap(java.util.Optional::stream)
            .toList();
    var state = hiringStates.find(teamId, phase);
    var shortlistIds = state.map(TeamHiringState::shortlist).orElse(java.util.List.of());
    var history = interviews.findAllFor(teamId, phase);
    var view =
        HeadCoachHiringViewModel.assemble(
            league, pool, prefs, shortlistIds, history, DEFAULT_WEEKLY_CAPACITY);
    log.info(
        "interview recorded leagueId={} teamId={} candidateId={} interest={}",
        leagueId,
        teamId,
        candidateId,
        interest);
    return new InterviewResult.Started(view);
  }

  private void appendToHiringState(long teamId, long candidateId, LeaguePhase phase) {
    var existing = hiringStates.find(teamId, phase);
    var shortlistIds = existing.map(TeamHiringState::shortlist).orElse(java.util.List.of());
    var interviewingIds =
        existing.map(TeamHiringState::interviewingCandidateIds).orElse(java.util.List.of());
    var updated = new ArrayList<Long>(interviewingIds.size() + 1);
    updated.addAll(interviewingIds);
    updated.add(candidateId);
    hiringStates.upsert(
        new TeamHiringState(
            existing.map(TeamHiringState::id).orElse(0L),
            teamId,
            phase,
            HiringStep.SEARCHING,
            shortlistIds,
            java.util.List.copyOf(updated)));
  }
}
