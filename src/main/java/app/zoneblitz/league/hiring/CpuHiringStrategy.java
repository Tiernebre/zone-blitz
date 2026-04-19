package app.zoneblitz.league.hiring;

import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.team.CpuTeamStrategy;
import app.zoneblitz.league.team.TeamHiringState;
import app.zoneblitz.league.team.TeamHiringStateRepository;
import app.zoneblitz.league.team.TeamProfile;
import app.zoneblitz.league.team.TeamProfiles;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * CPU decision-maker for the two hiring phases ({@link LeaguePhase#HIRING_HEAD_COACH} and {@link
 * LeaguePhase#HIRING_DIRECTOR_OF_SCOUTING}). One bean is registered per phase; behavior is
 * identical — only the phase/pool-type pair differs.
 *
 * <p>Hidden coach ratings are never consulted. Interview ordering and bid sizing key off {@link
 * InterestScoring#normalizedScore} — the same preference-fit signal humans see as an interview
 * bucket. CPUs pick candidates most likely to accept, not the ones with the highest latent rating.
 *
 * <p>Runs one day of hiring behavior per invocation:
 *
 * <ol>
 *   <li>If the team is already {@link HiringStep#HIRED}, do nothing.
 *   <li>Interview the best-fit unhired candidates not yet interviewed, up to daily capacity.
 *   <li>If no active CPU offer is outstanding, submit a single offer on the highest-fit interviewed
 *       candidate that is still unhired and not {@code NOT_INTERESTED}. Terms scale the candidate's
 *       preference targets by a willingness-to-pay multiplier keyed off the fit score.
 * </ol>
 */
public class CpuHiringStrategy implements CpuTeamStrategy {

  private static final Logger log = LoggerFactory.getLogger(CpuHiringStrategy.class);

  private final LeaguePhase phase;
  private final CandidatePoolType poolType;
  private final CandidatePoolRepository pools;
  private final CandidateRepository candidates;
  private final CandidatePreferencesRepository preferences;
  private final CandidateOfferRepository offers;
  private final TeamHiringStateRepository hiringStates;
  private final TeamInterviewRepository interviews;
  private final TeamProfiles teamProfiles;

  public CpuHiringStrategy(
      LeaguePhase phase,
      CandidatePoolType poolType,
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      CandidateOfferRepository offers,
      TeamHiringStateRepository hiringStates,
      TeamInterviewRepository interviews,
      TeamProfiles teamProfiles) {
    this.phase = phase;
    this.poolType = poolType;
    this.pools = pools;
    this.candidates = candidates;
    this.preferences = preferences;
    this.offers = offers;
    this.hiringStates = hiringStates;
    this.interviews = interviews;
    this.teamProfiles = teamProfiles;
  }

  @Override
  public LeaguePhase phase() {
    return phase;
  }

  @Override
  public void execute(long leagueId, long teamId, int phaseDay) {
    var existing = hiringStates.find(teamId, phase());
    if (existing.isPresent() && existing.get().step() == HiringStep.HIRED) {
      return;
    }
    var maybePool = pools.findByLeaguePhaseAndType(leagueId, phase(), poolType);
    if (maybePool.isEmpty()) {
      return;
    }
    var maybeProfile = teamProfiles.forTeam(teamId);
    if (maybeProfile.isEmpty()) {
      return;
    }
    var profile = maybeProfile.get();

    var poolCandidates = candidates.findAllByPoolId(maybePool.get().id());
    var unhired = poolCandidates.stream().filter(c -> c.hiredByTeamId().isEmpty()).toList();
    if (unhired.isEmpty()) {
      return;
    }
    var prefsByCandidate = prefsByCandidate(unhired);

    runInterviews(leagueId, teamId, phaseDay, unhired, profile, prefsByCandidate);
    submitOfferIfNone(leagueId, teamId, phaseDay, unhired, profile, prefsByCandidate);
  }

  private Map<Long, CandidatePreferences> prefsByCandidate(List<Candidate> unhired) {
    var m = new HashMap<Long, CandidatePreferences>();
    for (var c : unhired) {
      preferences.findByCandidateId(c.id()).ifPresent(p -> m.put(c.id(), p));
    }
    return m;
  }

  private void runInterviews(
      long leagueId,
      long teamId,
      int phaseDay,
      List<Candidate> unhired,
      TeamProfile profile,
      Map<Long, CandidatePreferences> prefsByCandidate) {
    var capacity = StartInterview.DAILY_CAPACITY;
    var used = interviews.countForDay(teamId, phase(), phaseDay);
    if (used >= capacity) {
      return;
    }
    var remaining = capacity - used;
    var ordered =
        unhired.stream()
            .filter(c -> prefsByCandidate.containsKey(c.id()))
            .filter(c -> interviews.countForCandidate(teamId, c.id(), phase()) == 0)
            .sorted(
                Comparator.comparingDouble(
                        (Candidate c) -> -fitScore(profile, prefsByCandidate.get(c.id())))
                    .thenComparingLong(Candidate::id))
            .limit(remaining)
            .toList();
    for (var candidate : ordered) {
      recordInterview(leagueId, teamId, phaseDay, candidate, profile, prefsByCandidate);
    }
  }

  private void recordInterview(
      long leagueId,
      long teamId,
      int phaseDay,
      Candidate candidate,
      TeamProfile profile,
      Map<Long, CandidatePreferences> prefsByCandidate) {
    var interest = InterestScoring.score(profile, prefsByCandidate.get(candidate.id()));
    interviews.insert(new NewTeamInterview(teamId, candidate.id(), phase(), phaseDay, 1, interest));
    appendInterviewing(teamId, candidate.id());
    log.debug(
        "cpu interview leagueId={} teamId={} candidateId={} interest={}",
        leagueId,
        teamId,
        candidate.id(),
        interest);
  }

  private void appendInterviewing(long teamId, long candidateId) {
    var existing = hiringStates.find(teamId, phase());
    var interviewing = existing.map(TeamHiringState::interviewingCandidateIds).orElse(List.of());
    var updated = new ArrayList<Long>(interviewing.size() + 1);
    updated.addAll(interviewing);
    updated.add(candidateId);
    hiringStates.upsert(
        new TeamHiringState(
            existing.map(TeamHiringState::id).orElse(0L),
            teamId,
            phase(),
            HiringStep.SEARCHING,
            List.copyOf(updated)));
  }

  private void submitOfferIfNone(
      long leagueId,
      long teamId,
      int phaseDay,
      List<Candidate> unhired,
      TeamProfile profile,
      Map<Long, CandidatePreferences> prefsByCandidate) {
    var existingOffers = offers.findActiveForTeam(teamId);
    if (!existingOffers.isEmpty()) {
      return;
    }
    var interviewedIds =
        interviews.findAllFor(teamId, phase()).stream().map(TeamInterview::candidateId).toList();
    var unhiredById =
        unhired.stream().collect(Collectors.toMap(Candidate::id, c -> c, (a, b) -> a));
    var ordered =
        interviewedIds.stream()
            .map(unhiredById::get)
            .filter(Objects::nonNull)
            .filter(c -> prefsByCandidate.containsKey(c.id()))
            .sorted(
                Comparator.comparingDouble(
                        (Candidate c) -> -fitScore(profile, prefsByCandidate.get(c.id())))
                    .thenComparingLong(Candidate::id))
            .toList();
    for (var candidate : ordered) {
      var prefs = prefsByCandidate.get(candidate.id());
      var fit = fitScore(profile, prefs);
      if (fit < InterestScoring.LUKEWARM_THRESHOLD) {
        continue;
      }
      var terms = buildOfferTerms(prefs, fit);
      var saved =
          offers.insertActive(candidate.id(), teamId, OfferTermsJson.toJson(terms), phaseDay);
      log.info(
          "cpu offer submitted leagueId={} teamId={} candidateId={} offerId={} fit={} day={}",
          leagueId,
          teamId,
          candidate.id(),
          saved.id(),
          fit,
          phaseDay);
      return;
    }
  }

  /**
   * Simple willingness-to-pay: scale the candidate's compensation target by 0.90..1.20 linear in
   * preference-fit score. Contract length and guaranteed money mirror the candidate's own targets
   * so the CPU never bids below the floor fit. Role scope / staff continuity match the candidate's
   * preference target so categorical dimensions always score 1.0.
   */
  private OfferTerms buildOfferTerms(CandidatePreferences prefs, double fit) {
    var clamped = Math.max(0.0, Math.min(1.0, fit));
    var multiplier = 0.90 + clamped * 0.30;
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

  private static double fitScore(TeamProfile profile, CandidatePreferences prefs) {
    return InterestScoring.normalizedScore(profile, prefs);
  }

  private Optional<TeamHiringState> findExisting(long teamId) {
    return hiringStates.find(teamId, phase());
  }
}
