package app.zoneblitz.league.hiring;

import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.staff.NewTeamStaffMember;
import app.zoneblitz.league.staff.StaffRole;
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
 * Default {@link OfferResolver}. Two-phase per tick:
 *
 * <ol>
 *   <li>Score every ACTIVE offer in the league, update stance and enforce the revision cap:
 *       <ul>
 *         <li>Score ≥ {@link StanceEvaluator#AGREE_THRESHOLD} → {@link OfferStance#AGREED}.
 *         <li>Below threshold and revisions remaining → {@link OfferStance#RENEGOTIATE}.
 *         <li>Below threshold and revisions exhausted → offer {@link OfferStatus#REJECTED} (the
 *             candidate walks).
 *       </ul>
 *   <li>Resolve candidates with one or more AGREED offers:
 *       <ul>
 *         <li>If the user's team has an AGREED offer, leave the offers open — the user must click
 *             Hire explicitly. This gives the user priority over CPU teams.
 *         <li>Otherwise the highest-scoring CPU AGREED offer is ACCEPTED; sibling AGREED offers
 *             from other CPU teams are REJECTED (candidate off the market).
 *       </ul>
 * </ol>
 *
 * <p>Idempotent on re-run within the same day.
 */
@Component
public class PreferenceScoringOfferResolver implements OfferResolver {

  private static final Logger log = LoggerFactory.getLogger(PreferenceScoringOfferResolver.class);

  private final CandidateOfferRepository offers;
  private final CandidateRepository candidates;
  private final CandidatePoolRepository pools;
  private final CandidatePreferencesRepository preferences;
  private final TeamProfiles teamProfiles;
  private final TeamHiringStateRepository hiringStates;
  private final TeamStaffRepository staff;
  private final TeamLookup teams;
  private final CandidateRandomSources rngs;

  public PreferenceScoringOfferResolver(
      CandidateOfferRepository offers,
      CandidateRepository candidates,
      CandidatePoolRepository pools,
      CandidatePreferencesRepository preferences,
      TeamProfiles teamProfiles,
      TeamHiringStateRepository hiringStates,
      TeamStaffRepository staff,
      TeamLookup teams,
      CandidateRandomSources rngs) {
    this.offers = offers;
    this.candidates = candidates;
    this.pools = pools;
    this.preferences = preferences;
    this.teamProfiles = teamProfiles;
    this.hiringStates = hiringStates;
    this.staff = staff;
    this.teams = teams;
    this.rngs = rngs;
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
    restance(leagueId);
    autoHireCpuWinners(leagueId, phase, dayAtResolve);
  }

  private void restance(long leagueId) {
    for (var offer : offers.findActiveForLeague(leagueId)) {
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
      finalizeHire(phase, dayAtResolve, candidate, winner.get());
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
      LeaguePhase phase, int dayAtResolve, Candidate candidate, CandidateOffer winner) {
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
    staff.insert(
        new NewTeamStaffMember(
            winner.teamId(),
            candidate.id(),
            staffRoleFor(phase),
            Optional.empty(),
            phase,
            dayAtResolve));
    log.info(
        "cpu auto-hire candidateId={} teamId={} offerId={} day={}",
        candidate.id(),
        winner.teamId(),
        winner.id(),
        dayAtResolve);
  }

  private static StaffRole staffRoleFor(LeaguePhase phase) {
    return switch (phase) {
      case HIRING_HEAD_COACH -> StaffRole.HEAD_COACH;
      case HIRING_DIRECTOR_OF_SCOUTING -> StaffRole.DIRECTOR_OF_SCOUTING;
      case INITIAL_SETUP, ASSEMBLING_STAFF, COMPLETE ->
          throw new IllegalStateException("no staff role for non-hiring phase " + phase);
    };
  }

  private static Optional<CandidatePoolType> poolTypeFor(LeaguePhase phase) {
    return switch (phase) {
      case HIRING_HEAD_COACH -> Optional.of(CandidatePoolType.HEAD_COACH);
      case HIRING_DIRECTOR_OF_SCOUTING -> Optional.of(CandidatePoolType.DIRECTOR_OF_SCOUTING);
      case INITIAL_SETUP, ASSEMBLING_STAFF, COMPLETE -> Optional.empty();
    };
  }
}
