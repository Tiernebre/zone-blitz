package app.zoneblitz.league.hiring;

import app.zoneblitz.league.LeagueRepository;
import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.staff.NewTeamStaffMember;
import app.zoneblitz.league.staff.StaffRole;
import app.zoneblitz.league.staff.TeamStaffMember;
import app.zoneblitz.league.staff.TeamStaffRepository;
import app.zoneblitz.league.team.TeamHiringState;
import app.zoneblitz.league.team.TeamHiringStateRepository;
import app.zoneblitz.league.team.TeamLookup;
import app.zoneblitz.league.team.TeamProfiles;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Default {@link OfferResolver}. Each tick runs, in order:
 *
 * <ol>
 *   <li>Expire any {@link OfferStatus#COUNTER_PENDING} offers whose {@code counterDeadlineDay} has
 *       passed (reject them so the leading offer proceeds).
 *   <li>Ask each CPU team with a live counter-pending offer to {@link
 *       CpuHiringStrategy#respondToCounter} — match or walk.
 *   <li>Scan unhired candidates with 2+ ACTIVE offers and flip the preferred (highest preference
 *       score) offer to {@link OfferStatus#COUNTER_PENDING} when the leading team is winning by ≤
 *       {@link #COUNTER_MARGIN}.
 *   <li>Score every ACTIVE offer, update stance, enforce the revision cap.
 *   <li>Resolve candidates with one or more AGREED offers: user AGREED → defer to explicit Hire;
 *       otherwise auto-hire the highest-scoring CPU AGREED offer.
 * </ol>
 *
 * <p>Idempotent on re-run within the same day.
 */
@Component
public class PreferenceScoringOfferResolver implements OfferResolver {

  private static final Logger log = LoggerFactory.getLogger(PreferenceScoringOfferResolver.class);

  /**
   * Max preference-score gap (as fraction of leader) at which the preferred team gets a counter.
   */
  private static final double COUNTER_MARGIN = 0.10;

  /** Phase-day window the preferred team has to respond to a counter before it auto-expires. */
  private static final int COUNTER_WINDOW_DAYS = 2;

  private final CandidateOfferRepository offers;
  private final CandidateRepository candidates;
  private final CandidatePoolRepository pools;
  private final CandidatePreferencesRepository preferences;
  private final TeamProfiles teamProfiles;
  private final TeamHiringStateRepository hiringStates;
  private final TeamStaffRepository staff;
  private final TeamLookup teams;
  private final CandidateRandomSources rngs;
  private final StaffBudgetRepository budgets;
  private final StaffContractRepository staffContracts;
  private final LeagueRepository leagues;
  private final List<CpuHiringStrategy> cpuStrategies;

  public PreferenceScoringOfferResolver(
      CandidateOfferRepository offers,
      CandidateRepository candidates,
      CandidatePoolRepository pools,
      CandidatePreferencesRepository preferences,
      TeamProfiles teamProfiles,
      TeamHiringStateRepository hiringStates,
      TeamStaffRepository staff,
      TeamLookup teams,
      CandidateRandomSources rngs,
      StaffBudgetRepository budgets,
      StaffContractRepository staffContracts,
      LeagueRepository leagues,
      List<CpuHiringStrategy> cpuStrategies) {
    this.offers = offers;
    this.candidates = candidates;
    this.pools = pools;
    this.preferences = preferences;
    this.teamProfiles = teamProfiles;
    this.hiringStates = hiringStates;
    this.staff = staff;
    this.teams = teams;
    this.rngs = rngs;
    this.budgets = budgets;
    this.staffContracts = staffContracts;
    this.leagues = leagues;
    this.cpuStrategies = cpuStrategies;
  }

  @Override
  public void resolve(long leagueId, LeaguePhase phase, int dayAtResolve) {
    var poolType = poolTypeFor(phase);
    if (poolType.isEmpty()) {
      return;
    }
    var pool = pools.findByLeaguePhaseAndType(leagueId, phase, poolType.get());
    if (pool.isEmpty()) {
      return;
    }
    expireDeadCounters(leagueId, dayAtResolve);
    cpuRespondToCounters(leagueId, phase, dayAtResolve);
    triggerCounters(leagueId, phase, dayAtResolve);
    restance(leagueId, dayAtResolve);
    autoHireCpuWinners(leagueId, phase, dayAtResolve);
  }

  private void expireDeadCounters(long leagueId, int dayAtResolve) {
    for (var offer : offers.findCounterPendingForLeague(leagueId)) {
      var deadline = offer.counterDeadlineDay().orElse(Integer.MAX_VALUE);
      if (deadline < dayAtResolve) {
        offers.resolve(offer.id(), OfferStatus.REJECTED);
        log.info(
            "counter expired offerId={} candidateId={} deadline={} day={}",
            offer.id(),
            offer.candidateId(),
            deadline,
            dayAtResolve);
      }
    }
  }

  private void cpuRespondToCounters(long leagueId, LeaguePhase phase, int dayAtResolve) {
    var userTeamId = teams.userTeamIdForLeague(leagueId);
    var strategy = cpuStrategyFor(phase);
    if (strategy.isEmpty()) {
      return;
    }
    for (var offer : offers.findCounterPendingForLeague(leagueId)) {
      if (userTeamId.isPresent() && userTeamId.get() == offer.teamId()) {
        continue;
      }
      var competingId = offer.competingOfferId();
      if (competingId.isEmpty()) {
        continue;
      }
      var competing = offers.findById(competingId.get());
      if (competing.isEmpty()) {
        continue;
      }
      var seasonSummary = leagueSeason(leagueId);
      if (seasonSummary.isEmpty()) {
        continue;
      }
      var budget = budgets.committed(offer.teamId(), seasonSummary.get());
      strategy
          .get()
          .respondToCounter(leagueId, offer.teamId(), dayAtResolve, offer, competing.get(), budget);
    }
  }

  private void triggerCounters(long leagueId, LeaguePhase phase, int dayAtResolve) {
    var pool = pools.findByLeaguePhaseAndType(leagueId, phase, poolTypeFor(phase).get());
    if (pool.isEmpty()) {
      return;
    }
    for (var candidate : candidates.findAllByPoolId(pool.get().id())) {
      if (candidate.hiredByTeamId().isPresent()) {
        continue;
      }
      var all = offers.findActiveForCandidate(candidate.id());
      var active = all.stream().filter(o -> o.status() == OfferStatus.ACTIVE).toList();
      if (active.size() < 2) {
        continue;
      }
      var counterPending =
          offers.findAllForCandidate(candidate.id()).stream()
              .filter(o -> o.status() == OfferStatus.COUNTER_PENDING)
              .toList();
      var prefs = preferences.findByCandidateId(candidate.id());
      if (prefs.isEmpty()) {
        continue;
      }
      record Scored(CandidateOffer offer, double totalScore, double preferenceScore) {}
      var scored = new ArrayList<Scored>();
      for (var o : active) {
        var profile = teamProfiles.forTeam(o.teamId());
        if (profile.isEmpty()) {
          continue;
        }
        var total =
            OfferScoring.score(OfferTermsJson.fromJson(o.terms()), profile.get(), prefs.get());
        var preference = InterestScoring.normalizedScore(profile.get(), prefs.get());
        scored.add(new Scored(o, total, preference));
      }
      if (scored.size() < 2) {
        continue;
      }
      var leader =
          scored.stream()
              .max(
                  Comparator.comparingDouble(Scored::totalScore)
                      .thenComparingLong(s -> -s.offer().id()))
              .orElseThrow();
      var preferred =
          scored.stream()
              .max(
                  Comparator.comparingDouble(Scored::preferenceScore)
                      .thenComparingLong(s -> -s.offer().id()))
              .orElseThrow();
      if (preferred.offer().teamId() == leader.offer().teamId()) {
        continue;
      }
      if (counterPending.stream().anyMatch(o -> o.teamId() == preferred.offer().teamId())) {
        continue;
      }
      var leaderScore = leader.totalScore();
      if (leaderScore <= 0.0) {
        continue;
      }
      var gap = (leaderScore - preferred.totalScore()) / leaderScore;
      if (gap > COUNTER_MARGIN) {
        continue;
      }
      offers.flipToCounterPending(
          preferred.offer().id(), leader.offer().id(), dayAtResolve + COUNTER_WINDOW_DAYS);
      log.info(
          "counter triggered candidateId={} preferredOfferId={} leadingOfferId={} gap={} day={}",
          candidate.id(),
          preferred.offer().id(),
          leader.offer().id(),
          gap,
          dayAtResolve);
    }
  }

  private Optional<CpuHiringStrategy> cpuStrategyFor(LeaguePhase phase) {
    return cpuStrategies.stream().filter(s -> s.phase() == phase).findFirst();
  }

  private Optional<Integer> leagueSeason(long leagueId) {
    return leagues.findById(leagueId).map(app.zoneblitz.league.League::season);
  }

  private void restance(long leagueId, int dayAtResolve) {
    for (var offer : offers.findActiveForLeague(leagueId)) {
      // Offers submitted (or revised) today don't resolve until the next tick. Without this gate,
      // the CPU can offer and auto-hire in a single day-advance before the user sees the offer
      // appear. A one-day response delay gives every franchise — user included — a full day to see
      // what's on the board and react before stances land.
      if (offer.submittedAtDay() >= dayAtResolve) {
        continue;
      }
      var prefs = preferences.findByCandidateId(offer.candidateId());
      var profile = teamProfiles.forTeam(offer.teamId());
      if (prefs.isEmpty() || profile.isEmpty()) {
        log.warn("offer restance skipped offerId={} — missing prefs or team profile", offer.id());
        continue;
      }
      var terms = OfferTermsJson.fromJson(offer.terms());
      var eval = StanceEvaluator.evaluate(terms, profile.get(), prefs.get());
      if (eval.stance() == OfferStance.AGREED) {
        offers.setStance(offer.id(), OfferStance.AGREED);
      } else if (offer.revisionCount() >= StanceEvaluator.REVISION_CAP) {
        offers.resolve(offer.id(), OfferStatus.REJECTED);
        log.info(
            "offer walked — revisions exhausted offerId={} candidateId={} score={}",
            offer.id(),
            offer.candidateId(),
            eval.score());
      } else {
        offers.setStance(offer.id(), OfferStance.RENEGOTIATE);
      }
    }
  }

  private void autoHireCpuWinners(long leagueId, LeaguePhase phase, int dayAtResolve) {
    var userTeamId = teams.userTeamIdForLeague(leagueId);
    var pool = pools.findByLeaguePhaseAndType(leagueId, phase, poolTypeFor(phase).get());
    if (pool.isEmpty()) {
      return;
    }
    for (var candidate : candidates.findAllByPoolId(pool.get().id())) {
      if (candidate.hiredByTeamId().isPresent()) {
        continue;
      }
      var active = offers.findActiveForCandidate(candidate.id());
      // A counter matched this tick re-enters as ACTIVE with submittedAtDay==dayAtResolve. Give
      // the preferred team one tick for the candidate to re-score those new terms before auto-hire
      // hands the seat to the leader.
      var matchedThisTick = active.stream().anyMatch(o -> o.submittedAtDay() >= dayAtResolve);
      if (matchedThisTick) {
        continue;
      }
      var agreed =
          active.stream().filter(o -> o.stance().orElse(null) == OfferStance.AGREED).toList();
      if (agreed.isEmpty()) {
        continue;
      }
      if (userTeamId.isPresent() && agreed.stream().anyMatch(o -> o.teamId() == userTeamId.get())) {
        continue;
      }
      var winner = chooseCpuWinner(leagueId, phase, candidate, agreed);
      if (winner.isEmpty()) {
        continue;
      }
      finalizeHire(leagueId, phase, dayAtResolve, candidate, winner.get());
    }
  }

  private Optional<CandidateOffer> chooseCpuWinner(
      long leagueId, LeaguePhase phase, Candidate candidate, List<CandidateOffer> agreed) {
    record Scored(CandidateOffer offer, double score) {}
    var prefs = preferences.findByCandidateId(candidate.id());
    if (prefs.isEmpty()) {
      return Optional.empty();
    }
    var scored = new ArrayList<Scored>();
    for (var o : agreed) {
      var profile = teamProfiles.forTeam(o.teamId());
      if (profile.isEmpty()) {
        continue;
      }
      var score =
          OfferScoring.score(OfferTermsJson.fromJson(o.terms()), profile.get(), prefs.get());
      scored.add(new Scored(o, score));
    }
    if (scored.isEmpty()) {
      return Optional.empty();
    }
    scored.sort(
        Comparator.comparingDouble(Scored::score)
            .reversed()
            .thenComparingLong(s -> s.offer().id()));
    var topScore = scored.getFirst().score();
    var tied = scored.stream().filter(s -> s.score() == topScore).toList();
    if (tied.size() == 1) {
      return Optional.of(tied.getFirst().offer());
    }
    var rng = rngs.forLeaguePhase(leagueId, phase).split(candidate.id());
    var sortedTied = new ArrayList<>(tied);
    sortedTied.sort(Comparator.comparingLong(s -> s.offer().id()));
    var pick = (int) ((rng.nextLong() & Long.MAX_VALUE) % sortedTied.size());
    return Optional.of(sortedTied.get(pick).offer());
  }

  private void finalizeHire(
      long leagueId,
      LeaguePhase phase,
      int dayAtResolve,
      Candidate candidate,
      CandidateOffer winner) {
    candidates.markHired(candidate.id(), winner.teamId());
    offers.resolve(winner.id(), OfferStatus.ACCEPTED);
    for (var other : offers.findActiveForCandidate(candidate.id())) {
      offers.resolve(other.id(), OfferStatus.REJECTED);
    }
    var existing = hiringStates.find(winner.teamId(), phase);
    hiringStates.upsert(
        new TeamHiringState(
            existing.map(TeamHiringState::id).orElse(0L),
            winner.teamId(),
            phase,
            HiringStep.HIRED,
            existing.map(TeamHiringState::interviewingCandidateIds).orElse(List.of())));
    var staffMember =
        staff.insert(
            new NewTeamStaffMember(
                winner.teamId(),
                candidate.id(),
                staffRoleFor(phase),
                Optional.empty(),
                phase,
                dayAtResolve));
    insertStaffContract(leagueId, candidate.id(), winner, staffMember);
    log.info(
        "cpu auto-hire candidateId={} teamId={} offerId={} day={}",
        candidate.id(),
        winner.teamId(),
        winner.id(),
        dayAtResolve);
  }

  private void insertStaffContract(
      long leagueId, long candidateId, CandidateOffer winner, TeamStaffMember staffMember) {
    var season = leagueSeason(leagueId);
    if (season.isEmpty()) {
      return;
    }
    var terms = OfferTermsJson.fromJson(winner.terms());
    var contract =
        StaffContractFactory.fromTerms(
            winner.teamId(), candidateId, staffMember.id(), terms, season.get());
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

  private static Optional<CandidatePoolType> poolTypeFor(LeaguePhase phase) {
    return switch (phase) {
      case HIRING_HEAD_COACH -> Optional.of(CandidatePoolType.HEAD_COACH);
      case HIRING_DIRECTOR_OF_SCOUTING -> Optional.of(CandidatePoolType.DIRECTOR_OF_SCOUTING);
      case INITIAL_SETUP, EXPANSION_DRAFT_SCOUTING, ASSEMBLING_STAFF, COMPLETE -> Optional.empty();
    };
  }
}
