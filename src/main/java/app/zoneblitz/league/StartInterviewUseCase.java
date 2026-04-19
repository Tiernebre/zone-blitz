package app.zoneblitz.league;

import app.zoneblitz.gamesimulator.rng.SplittableRandomSource;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Objects;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class StartInterviewUseCase implements StartInterview {

  private static final Logger log = LoggerFactory.getLogger(StartInterviewUseCase.class);
  private static final Pattern HIDDEN_OVERALL =
      Pattern.compile("\"overall\"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)");
  private static final double SCOUTED_LOWER = 20.0;
  private static final double SCOUTED_UPPER = 99.0;

  private final LeagueRepository leagues;
  private final CandidatePoolRepository pools;
  private final CandidateRepository candidates;
  private final CandidatePreferencesRepository preferences;
  private final FranchiseHiringStateRepository hiringStates;
  private final FranchiseInterviewRepository interviews;

  StartInterviewUseCase(
      LeagueRepository leagues,
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      FranchiseHiringStateRepository hiringStates,
      FranchiseInterviewRepository interviews) {
    this.leagues = leagues;
    this.pools = pools;
    this.candidates = candidates;
    this.preferences = preferences;
    this.hiringStates = hiringStates;
    this.interviews = interviews;
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
    if (league.phase() != LeaguePhase.HIRING_HEAD_COACH) {
      return new InterviewResult.NotFound(leagueId);
    }
    var maybePool =
        pools.findByLeaguePhaseAndType(
            leagueId, LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    if (maybePool.isEmpty()) {
      return new InterviewResult.NotFound(leagueId);
    }
    var maybeCandidate = candidates.findById(candidateId);
    if (maybeCandidate.isEmpty() || maybeCandidate.get().poolId() != maybePool.get().id()) {
      return new InterviewResult.UnknownCandidate(candidateId);
    }
    var franchiseId = league.userFranchise().id();
    var phaseWeek = league.phaseWeek();
    var weekCount =
        interviews.countForWeek(leagueId, franchiseId, LeaguePhase.HIRING_HEAD_COACH, phaseWeek);
    if (weekCount >= DEFAULT_WEEKLY_CAPACITY) {
      return new InterviewResult.CapacityReached(DEFAULT_WEEKLY_CAPACITY);
    }

    var candidate = maybeCandidate.get();
    var priorCount =
        interviews.countForCandidate(
            leagueId, franchiseId, candidateId, LeaguePhase.HIRING_HEAD_COACH);
    var newIndex = priorCount + 1;
    var trueRating = extractOverall(candidate.hiddenAttrs());
    var sigma = InterviewNoiseModel.headCoachSigma(newIndex);
    var rng = new SplittableRandomSource(seedFor(leagueId, franchiseId, candidateId, newIndex));
    var sample = trueRating + sigma * rng.nextGaussian();
    var clamped = Math.max(SCOUTED_LOWER, Math.min(SCOUTED_UPPER, sample));
    var scoutedOverall = BigDecimal.valueOf(clamped).setScale(2, RoundingMode.HALF_UP);

    interviews.insert(
        new NewFranchiseInterview(
            leagueId,
            franchiseId,
            candidateId,
            LeaguePhase.HIRING_HEAD_COACH,
            phaseWeek,
            newIndex,
            scoutedOverall));
    appendToHiringState(leagueId, franchiseId, candidateId);

    var pool = candidates.findAllByPoolId(maybePool.get().id());
    var prefs =
        pool.stream()
            .map(c -> preferences.findByCandidateId(c.id()))
            .flatMap(java.util.Optional::stream)
            .toList();
    var state = hiringStates.find(leagueId, franchiseId, LeaguePhase.HIRING_HEAD_COACH);
    var shortlistIds = state.map(FranchiseHiringState::shortlist).orElse(java.util.List.of());
    var history = interviews.findAllFor(leagueId, franchiseId, LeaguePhase.HIRING_HEAD_COACH);
    var view =
        HeadCoachHiringViewModel.assemble(
            league, pool, prefs, shortlistIds, history, DEFAULT_WEEKLY_CAPACITY);
    log.info(
        "interview recorded leagueId={} franchiseId={} candidateId={} index={} sigma={}",
        leagueId,
        franchiseId,
        candidateId,
        newIndex,
        sigma);
    return new InterviewResult.Started(view);
  }

  private void appendToHiringState(long leagueId, long franchiseId, long candidateId) {
    var existing = hiringStates.find(leagueId, franchiseId, LeaguePhase.HIRING_HEAD_COACH);
    var shortlistIds = existing.map(FranchiseHiringState::shortlist).orElse(java.util.List.of());
    var interviewingIds =
        existing.map(FranchiseHiringState::interviewingCandidateIds).orElse(java.util.List.of());
    var updated = new ArrayList<Long>(interviewingIds.size() + 1);
    updated.addAll(interviewingIds);
    updated.add(candidateId);
    hiringStates.upsert(
        new FranchiseHiringState(
            existing.map(FranchiseHiringState::id).orElse(0L),
            leagueId,
            franchiseId,
            LeaguePhase.HIRING_HEAD_COACH,
            HiringStep.SEARCHING,
            shortlistIds,
            java.util.List.copyOf(updated)));
  }

  private static double extractOverall(String hiddenAttrsJson) {
    var m = HIDDEN_OVERALL.matcher(hiddenAttrsJson);
    if (m.find()) {
      try {
        return Double.parseDouble(m.group(1));
      } catch (NumberFormatException ignored) {
        return 50.0;
      }
    }
    return 50.0;
  }

  private static long seedFor(long leagueId, long franchiseId, long candidateId, int index) {
    var seed = leagueId * 0x9E3779B97F4A7C15L;
    seed ^= Long.rotateLeft(franchiseId, 17) * 0xBF58476D1CE4E5B9L;
    seed ^= Long.rotateLeft(candidateId, 31) * 0x94D049BB133111EBL;
    seed ^= (long) index * 0xD1B54A32D192ED03L;
    return seed;
  }
}
