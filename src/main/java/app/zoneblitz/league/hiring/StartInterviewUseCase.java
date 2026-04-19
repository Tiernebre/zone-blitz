package app.zoneblitz.league.hiring;

import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.phase.HiringPhases;
import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.team.TeamHiringState;
import app.zoneblitz.league.team.TeamHiringStateRepository;
import app.zoneblitz.league.team.TeamProfiles;
import java.util.ArrayList;
import java.util.List;
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
    var phaseDay = league.phaseDay();

    if (interviews.countForCandidate(teamId, candidateId, phase) > 0) {
      return new InterviewResult.AlreadyInterviewed(candidateId);
    }

    var dayCount = interviews.countForDay(teamId, phase, phaseDay);
    if (dayCount >= DAILY_CAPACITY) {
      return new InterviewResult.CapacityReached(DAILY_CAPACITY);
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

    interviews.insert(new NewTeamInterview(teamId, candidateId, phase, phaseDay, 1, interest));
    appendToHiringState(teamId, candidateId, phase);

    log.info(
        "interview recorded leagueId={} teamId={} candidateId={} interest={}",
        leagueId,
        teamId,
        candidateId,
        interest);
    return new InterviewResult.Started(candidateId);
  }

  private void appendToHiringState(long teamId, long candidateId, LeaguePhase phase) {
    var existing = hiringStates.find(teamId, phase);
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
            List.copyOf(updated)));
  }
}
