package app.zoneblitz.league;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * CPU decision-maker for the two hiring phases ({@link LeaguePhase#HIRING_HEAD_COACH} and {@link
 * LeaguePhase#HIRING_DIRECTOR_OF_SCOUTING}). One bean is registered per phase; the behavior is
 * identical — only the phase/pool-type pair differs — because the hiring sub-state machine is
 * phase-agnostic per {@code docs/technical/league-phases.md} (Hiring sub-state machine).
 *
 * <p>Runs one week of hiring behavior per invocation:
 *
 * <ol>
 *   <li>If the franchise is already {@link HiringStep#HIRED}, do nothing.
 *   <li>If no shortlist yet, build one from the top candidates by scouted overall (unhired only),
 *       up to {@link #SHORTLIST_SIZE}.
 *   <li>Interview shortlisted candidates up to the weekly capacity, preferring the highest
 *       scouted-overall candidate the franchise has interviewed the fewest times. Interview rows
 *       follow the same noise model as user interviews ({@link InterviewNoiseModel}).
 *   <li>If no active CPU offer is outstanding, submit a single offer on the top shortlisted
 *       candidate that is still unhired and that the franchise does not already have an active
 *       offer on. Terms are derived from the candidate's scouted overall via a simple willingness-
 *       to-pay model keyed off the candidate's own compensation target — higher-rated candidates
 *       get premium bids, lower-rated ones get sub-target bids. This is deliberately modest — the
 *       league-phases doc calls for "no ML, no deep planning".
 * </ol>
 *
 * Determinism: all random draws come from a franchise-and-candidate split of {@link
 * CandidateRandomSources#forLeaguePhase(long, LeaguePhase)}, so the same seed reproduces identical
 * behavior.
 */
class CpuHiringStrategy implements CpuFranchiseStrategy {

  private static final Logger log = LoggerFactory.getLogger(CpuHiringStrategy.class);

  /** How many candidates a CPU franchise shortlists. Kept small per the ticket brief. */
  static final int SHORTLIST_SIZE = 4;

  private static final Pattern OVERALL_PATTERN =
      Pattern.compile("\"overall\"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)");
  private static final double SCOUTED_LOWER = 20.0;
  private static final double SCOUTED_UPPER = 99.0;

  private final LeaguePhase phase;
  private final CandidatePoolType poolType;
  private final CandidatePoolRepository pools;
  private final CandidateRepository candidates;
  private final CandidatePreferencesRepository preferences;
  private final CandidateOfferRepository offers;
  private final FranchiseHiringStateRepository hiringStates;
  private final FranchiseInterviewRepository interviews;
  private final CandidateRandomSources rngs;

  CpuHiringStrategy(
      LeaguePhase phase,
      CandidatePoolType poolType,
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      CandidateOfferRepository offers,
      FranchiseHiringStateRepository hiringStates,
      FranchiseInterviewRepository interviews,
      CandidateRandomSources rngs) {
    this.phase = phase;
    this.poolType = poolType;
    this.pools = pools;
    this.candidates = candidates;
    this.preferences = preferences;
    this.offers = offers;
    this.hiringStates = hiringStates;
    this.interviews = interviews;
    this.rngs = rngs;
  }

  @Override
  public LeaguePhase phase() {
    return phase;
  }

  @Override
  public void execute(long leagueId, long franchiseId, int phaseWeek) {
    var existing = hiringStates.find(leagueId, franchiseId, phase());
    if (existing.isPresent() && existing.get().step() == HiringStep.HIRED) {
      return;
    }
    var maybePool = pools.findByLeaguePhaseAndType(leagueId, phase(), poolType);
    if (maybePool.isEmpty()) {
      return;
    }
    var poolCandidates = candidates.findAllByPoolId(maybePool.get().id());
    var unhired = poolCandidates.stream().filter(c -> c.hiredByFranchiseId().isEmpty()).toList();
    if (unhired.isEmpty()) {
      return;
    }

    var state = ensureState(leagueId, franchiseId, existing, unhired);
    var shortlist = state.shortlist();

    runInterviews(leagueId, franchiseId, phaseWeek, shortlist, unhired);
    submitOfferIfNone(leagueId, franchiseId, phaseWeek, shortlist, unhired);
  }

  private FranchiseHiringState ensureState(
      long leagueId,
      long franchiseId,
      java.util.Optional<FranchiseHiringState> existing,
      List<Candidate> unhired) {
    if (existing.isPresent() && !existing.get().shortlist().isEmpty()) {
      return existing.get();
    }
    var shortlist = pickShortlist(unhired);
    var stateId = existing.map(FranchiseHiringState::id).orElse(0L);
    var interviewing =
        existing.map(FranchiseHiringState::interviewingCandidateIds).orElse(List.of());
    return hiringStates.upsert(
        new FranchiseHiringState(
            stateId,
            leagueId,
            franchiseId,
            phase(),
            HiringStep.SEARCHING,
            shortlist,
            interviewing));
  }

  private List<Long> pickShortlist(List<Candidate> unhired) {
    return unhired.stream()
        .sorted(
            Comparator.comparingDouble((Candidate c) -> scoutedOverall(c.scoutedAttrs()))
                .reversed()
                .thenComparingLong(Candidate::id))
        .limit(SHORTLIST_SIZE)
        .map(Candidate::id)
        .toList();
  }

  private void runInterviews(
      long leagueId,
      long franchiseId,
      int phaseWeek,
      List<Long> shortlist,
      List<Candidate> unhired) {
    var unhiredIds = unhired.stream().map(Candidate::id).toList();
    var capacity = StartInterview.DEFAULT_WEEKLY_CAPACITY;
    var used = interviews.countForWeek(leagueId, franchiseId, phase(), phaseWeek);
    if (used >= capacity) {
      return;
    }
    var candidatesById =
        unhired.stream()
            .collect(
                java.util.stream.Collectors.toMap(
                    Candidate::id, c -> c, (a, b) -> a, java.util.LinkedHashMap::new));
    var eligible =
        shortlist.stream().filter(unhiredIds::contains).map(candidatesById::get).toList();
    var remaining = capacity - used;
    var priorCounts = new java.util.HashMap<Long, Integer>();
    for (var c : eligible) {
      priorCounts.put(c.id(), interviews.countForCandidate(leagueId, franchiseId, c.id(), phase()));
    }
    var ordered =
        eligible.stream()
            .sorted(
                Comparator.comparingInt((Candidate c) -> priorCounts.get(c.id()))
                    .thenComparingDouble((Candidate c) -> -scoutedOverall(c.scoutedAttrs()))
                    .thenComparingLong(Candidate::id))
            .limit(remaining)
            .toList();
    for (var candidate : ordered) {
      recordInterview(leagueId, franchiseId, phaseWeek, candidate, priorCounts.get(candidate.id()));
    }
  }

  private void recordInterview(
      long leagueId, long franchiseId, int phaseWeek, Candidate candidate, int priorCount) {
    var newIndex = priorCount + 1;
    var trueRating = extractDoubleOrDefault(OVERALL_PATTERN, candidate.hiddenAttrs(), 50.0);
    var sigma = InterviewNoiseModel.headCoachSigma(newIndex);
    var rng = interviewRng(leagueId, franchiseId, candidate.id(), newIndex);
    var sample = trueRating + sigma * rng.nextGaussian();
    var clamped = Math.max(SCOUTED_LOWER, Math.min(SCOUTED_UPPER, sample));
    var scouted = BigDecimal.valueOf(clamped).setScale(2, RoundingMode.HALF_UP);
    interviews.insert(
        new NewFranchiseInterview(
            leagueId, franchiseId, candidate.id(), phase(), phaseWeek, newIndex, scouted));
    appendInterviewing(leagueId, franchiseId, candidate.id());
    log.debug(
        "cpu interview leagueId={} franchiseId={} candidateId={} index={} sigma={}",
        leagueId,
        franchiseId,
        candidate.id(),
        newIndex,
        sigma);
  }

  private void appendInterviewing(long leagueId, long franchiseId, long candidateId) {
    var existing = hiringStates.find(leagueId, franchiseId, phase());
    var shortlist = existing.map(FranchiseHiringState::shortlist).orElse(List.of());
    var interviewing =
        existing.map(FranchiseHiringState::interviewingCandidateIds).orElse(List.of());
    var updated = new ArrayList<Long>(interviewing.size() + 1);
    updated.addAll(interviewing);
    updated.add(candidateId);
    hiringStates.upsert(
        new FranchiseHiringState(
            existing.map(FranchiseHiringState::id).orElse(0L),
            leagueId,
            franchiseId,
            phase(),
            HiringStep.SEARCHING,
            shortlist,
            List.copyOf(updated)));
  }

  private void submitOfferIfNone(
      long leagueId,
      long franchiseId,
      int phaseWeek,
      List<Long> shortlist,
      List<Candidate> unhired) {
    var existingOffers = offers.findActiveForFranchise(franchiseId);
    if (!existingOffers.isEmpty()) {
      return;
    }
    var unhiredById =
        unhired.stream()
            .collect(java.util.stream.Collectors.toMap(Candidate::id, c -> c, (a, b) -> a));
    for (var candidateId : shortlist) {
      var candidate = unhiredById.get(candidateId);
      if (candidate == null) {
        continue;
      }
      var prefs = preferences.findByCandidateId(candidateId);
      if (prefs.isEmpty()) {
        continue;
      }
      var terms = buildOfferTerms(candidate, prefs.get());
      var saved =
          offers.insertActive(candidate.id(), franchiseId, OfferTermsJson.toJson(terms), phaseWeek);
      log.info(
          "cpu offer submitted leagueId={} franchiseId={} candidateId={} offerId={} week={}",
          leagueId,
          franchiseId,
          candidate.id(),
          saved.id(),
          phaseWeek);
      return;
    }
  }

  /**
   * Simple willingness-to-pay: scale the candidate's compensation target by 0.85..1.20 linear in
   * scouted overall. Contract length and guaranteed money mirror the candidate's own targets so the
   * CPU never bids below the floor fit. Role scope / staff continuity match the candidate's
   * preference target so categorical dimensions always score 1.0.
   */
  private OfferTerms buildOfferTerms(Candidate candidate, CandidatePreferences prefs) {
    var scouted = scoutedOverall(candidate.scoutedAttrs());
    var priority = (scouted - SCOUTED_LOWER) / (SCOUTED_UPPER - SCOUTED_LOWER);
    var multiplier = 0.85 + Math.max(0.0, Math.min(1.0, priority)) * 0.35;
    var compensation =
        prefs
            .compensationTarget()
            .multiply(BigDecimal.valueOf(multiplier))
            .setScale(2, RoundingMode.HALF_UP);
    return new OfferTerms(
        compensation,
        prefs.contractLengthTarget(),
        prefs.guaranteedMoneyTarget(),
        prefs.roleScopeTarget(),
        prefs.staffContinuityTarget());
  }

  private RandomSource interviewRng(long leagueId, long franchiseId, long candidateId, int index) {
    var base = rngs.forLeaguePhase(leagueId, phase());
    return base.split(franchiseId).split(candidateId).split(index);
  }

  private static double scoutedOverall(String scoutedAttrsJson) {
    return extractDoubleOrDefault(OVERALL_PATTERN, scoutedAttrsJson, 50.0);
  }

  private static double extractDoubleOrDefault(Pattern pattern, String json, double fallback) {
    var m = pattern.matcher(json);
    if (m.find()) {
      try {
        return Double.parseDouble(m.group(1));
      } catch (NumberFormatException ignored) {
        return fallback;
      }
    }
    return fallback;
  }
}
