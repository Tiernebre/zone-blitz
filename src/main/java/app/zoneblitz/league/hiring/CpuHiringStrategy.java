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
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * CPU decision-maker for the two hiring phases ({@link LeaguePhase#HIRING_HEAD_COACH} and {@link
 * LeaguePhase#HIRING_DIRECTOR_OF_SCOUTING}). One bean is registered per phase; behavior is
 * identical — only the phase/pool-type pair differs.
 *
 * <p>Hidden coach ratings are never consulted. Shortlisting, interview ordering, and bid sizing all
 * key off {@link InterestScoring#normalizedScore} — the same preference-fit signal humans see as an
 * interview bucket. CPUs pick candidates most likely to accept, not the ones with the highest
 * latent rating.
 *
 * <p>Runs one week of hiring behavior per invocation:
 *
 * <ol>
 *   <li>If the team is already {@link HiringStep#HIRED}, do nothing.
 *   <li>If no shortlist yet, build one from the top candidates by preference-fit score (unhired
 *       only), up to {@link #SHORTLIST_SIZE}.
 *   <li>Interview shortlisted candidates up to the weekly capacity, skipping any already
 *       interviewed (one-shot). Ordering prefers highest fit score first.
 *   <li>If no active CPU offer is outstanding, submit a single offer on the top shortlisted
 *       candidate that is still unhired, is not in {@code NOT_INTERESTED}, and that the team does
 *       not already have an active offer on. Terms scale the candidate's preference targets by a
 *       willingness-to-pay multiplier keyed off the fit score.
 * </ol>
 */
public class CpuHiringStrategy implements CpuTeamStrategy {

  private static final Logger log = LoggerFactory.getLogger(CpuHiringStrategy.class);

  /** How many candidates a CPU team shortlists. Kept small per the ticket brief. */
  static final int SHORTLIST_SIZE = 4;

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
  public void execute(long leagueId, long teamId, int phaseWeek) {
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

    var state = ensureState(teamId, existing, unhired, profile, prefsByCandidate);
    var shortlist = state.shortlist();

    runInterviews(leagueId, teamId, phaseWeek, shortlist, unhired, profile, prefsByCandidate);
    submitOfferIfNone(leagueId, teamId, phaseWeek, shortlist, unhired, profile, prefsByCandidate);
  }

  private java.util.Map<Long, CandidatePreferences> prefsByCandidate(List<Candidate> unhired) {
    var m = new java.util.HashMap<Long, CandidatePreferences>();
    for (var c : unhired) {
      preferences.findByCandidateId(c.id()).ifPresent(p -> m.put(c.id(), p));
    }
    return m;
  }

  private TeamHiringState ensureState(
      long teamId,
      Optional<TeamHiringState> existing,
      List<Candidate> unhired,
      TeamProfile profile,
      java.util.Map<Long, CandidatePreferences> prefsByCandidate) {
    if (existing.isPresent() && !existing.get().shortlist().isEmpty()) {
      return existing.get();
    }
    var shortlist = pickShortlist(unhired, profile, prefsByCandidate);
    var stateId = existing.map(TeamHiringState::id).orElse(0L);
    var interviewing = existing.map(TeamHiringState::interviewingCandidateIds).orElse(List.of());
    return hiringStates.upsert(
        new TeamHiringState(
            stateId, teamId, phase(), HiringStep.SEARCHING, shortlist, interviewing));
  }

  private List<Long> pickShortlist(
      List<Candidate> unhired,
      TeamProfile profile,
      java.util.Map<Long, CandidatePreferences> prefsByCandidate) {
    return unhired.stream()
        .filter(c -> prefsByCandidate.containsKey(c.id()))
        .sorted(
            Comparator.comparingDouble(
                    (Candidate c) -> -fitScore(profile, prefsByCandidate.get(c.id())))
                .thenComparingLong(Candidate::id))
        .limit(SHORTLIST_SIZE)
        .map(Candidate::id)
        .toList();
  }

  private void runInterviews(
      long leagueId,
      long teamId,
      int phaseWeek,
      List<Long> shortlist,
      List<Candidate> unhired,
      TeamProfile profile,
      java.util.Map<Long, CandidatePreferences> prefsByCandidate) {
    var capacity = StartInterview.DEFAULT_WEEKLY_CAPACITY;
    var used = interviews.countForWeek(teamId, phase(), phaseWeek);
    if (used >= capacity) {
      return;
    }
    var remaining = capacity - used;
    var candidatesById =
        unhired.stream()
            .collect(
                java.util.stream.Collectors.toMap(
                    Candidate::id, c -> c, (a, b) -> a, java.util.LinkedHashMap::new));
    var ordered =
        shortlist.stream()
            .map(candidatesById::get)
            .filter(java.util.Objects::nonNull)
            .filter(c -> prefsByCandidate.containsKey(c.id()))
            .filter(c -> interviews.countForCandidate(teamId, c.id(), phase()) == 0)
            .sorted(
                Comparator.comparingDouble(
                        (Candidate c) -> -fitScore(profile, prefsByCandidate.get(c.id())))
                    .thenComparingLong(Candidate::id))
            .limit(remaining)
            .toList();
    for (var candidate : ordered) {
      recordInterview(leagueId, teamId, phaseWeek, candidate, profile, prefsByCandidate);
    }
  }

  private void recordInterview(
      long leagueId,
      long teamId,
      int phaseWeek,
      Candidate candidate,
      TeamProfile profile,
      java.util.Map<Long, CandidatePreferences> prefsByCandidate) {
    var interest = InterestScoring.score(profile, prefsByCandidate.get(candidate.id()));
    interviews.insert(
        new NewTeamInterview(teamId, candidate.id(), phase(), phaseWeek, 1, interest));
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
    var shortlist = existing.map(TeamHiringState::shortlist).orElse(List.of());
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
            shortlist,
            List.copyOf(updated)));
  }

  private void submitOfferIfNone(
      long leagueId,
      long teamId,
      int phaseWeek,
      List<Long> shortlist,
      List<Candidate> unhired,
      TeamProfile profile,
      java.util.Map<Long, CandidatePreferences> prefsByCandidate) {
    var existingOffers = offers.findActiveForTeam(teamId);
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
      var prefs = prefsByCandidate.get(candidateId);
      if (prefs == null) {
        continue;
      }
      var fit = fitScore(profile, prefs);
      if (fit < InterestScoring.LUKEWARM_THRESHOLD) {
        continue;
      }
      var terms = buildOfferTerms(prefs, fit);
      var saved =
          offers.insertActive(candidate.id(), teamId, OfferTermsJson.toJson(terms), phaseWeek);
      log.info(
          "cpu offer submitted leagueId={} teamId={} candidateId={} offerId={} fit={} week={}",
          leagueId,
          teamId,
          candidate.id(),
          saved.id(),
          fit,
          phaseWeek);
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
}
