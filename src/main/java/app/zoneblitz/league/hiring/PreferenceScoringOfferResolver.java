package app.zoneblitz.league.hiring;

import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.staff.NewTeamStaffMember;
import app.zoneblitz.league.staff.StaffRole;
import app.zoneblitz.league.staff.TeamStaffRepository;
import app.zoneblitz.league.team.TeamHiringState;
import app.zoneblitz.league.team.TeamHiringStateRepository;
import app.zoneblitz.league.team.TeamProfiles;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Default {@link OfferResolver}: scores every candidate's active offers against their {@link
 * CandidatePreferences}, accepts the highest-scoring offer, rejects the rest.
 *
 * <p>Ties on composite score are broken deterministically by the candidate's seeded RNG (see {@code
 * docs/technical/league-phases.md}), falling back to offer id for total order safety.
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
  private final CandidateRandomSources rngs;

  public PreferenceScoringOfferResolver(
      CandidateOfferRepository offers,
      CandidateRepository candidates,
      CandidatePoolRepository pools,
      CandidatePreferencesRepository preferences,
      TeamProfiles teamProfiles,
      TeamHiringStateRepository hiringStates,
      TeamStaffRepository staff,
      CandidateRandomSources rngs) {
    this.offers = offers;
    this.candidates = candidates;
    this.pools = pools;
    this.preferences = preferences;
    this.teamProfiles = teamProfiles;
    this.hiringStates = hiringStates;
    this.staff = staff;
    this.rngs = rngs;
  }

  @Override
  public void resolve(long leagueId, LeaguePhase phase, int weekAtResolve) {
    var poolType = poolTypeFor(phase);
    if (poolType.isEmpty()) {
      return;
    }
    var pool = pools.findByLeaguePhaseAndType(leagueId, phase, poolType.get());
    if (pool.isEmpty()) {
      return;
    }

    var candidateRows = candidates.findAllByPoolId(pool.get().id());
    for (var candidate : candidateRows) {
      if (candidate.hiredByTeamId().isPresent()) {
        continue;
      }
      var activeOffers = offers.findActiveForCandidate(candidate.id());
      if (activeOffers.isEmpty()) {
        continue;
      }
      resolveForCandidate(leagueId, phase, weekAtResolve, candidate, activeOffers);
    }
  }

  private void resolveForCandidate(
      long leagueId,
      LeaguePhase phase,
      int weekAtResolve,
      Candidate candidate,
      List<CandidateOffer> activeOffers) {
    var maybePrefs = preferences.findByCandidateId(candidate.id());
    if (maybePrefs.isEmpty()) {
      log.warn("offer resolution skipped — no preferences for candidateId={}", candidate.id());
      return;
    }
    var prefs = maybePrefs.get();

    var scored = new ArrayList<ScoredOffer>(activeOffers.size());
    for (var offer : activeOffers) {
      var profile = teamProfiles.forTeam(offer.teamId());
      if (profile.isEmpty()) {
        log.warn(
            "offer resolution skipped offerId={} — no profile for teamId={}",
            offer.id(),
            offer.teamId());
        continue;
      }
      var terms = OfferTermsJson.fromJson(offer.terms());
      var score = OfferScoring.score(terms, profile.get(), prefs);
      scored.add(new ScoredOffer(offer, score));
    }
    if (scored.isEmpty()) {
      return;
    }

    var winner = chooseWinner(leagueId, phase, candidate.id(), scored);

    candidates.markHired(candidate.id(), winner.offer().teamId());
    offers.resolve(winner.offer().id(), OfferStatus.ACCEPTED);
    upsertHired(phase, winner.offer().teamId(), weekAtResolve, candidate.id());

    var winningTeam = winner.offer().teamId();
    for (var other : scored) {
      if (other.offer().id() != winner.offer().id()) {
        offers.resolve(other.offer().id(), OfferStatus.REJECTED);
      }
    }
    // Auto-reject any of this candidate's active offers from teams that did not win — the
    // candidate is off the market. `findActiveForCandidate` above captured the scored set, but a
    // candidate may have active offers from teams whose profiles are missing; reject those too so
    // the lifecycle is clean.
    for (var stray : offers.findActiveForCandidate(candidate.id())) {
      if (stray.teamId() != winningTeam) {
        offers.resolve(stray.id(), OfferStatus.REJECTED);
      }
    }

    log.info(
        "offer accepted leagueId={} candidateId={} teamId={} offerId={} score={} week={}",
        leagueId,
        candidate.id(),
        winner.offer().teamId(),
        winner.offer().id(),
        winner.score(),
        weekAtResolve);
  }

  private ScoredOffer chooseWinner(
      long leagueId, LeaguePhase phase, long candidateId, List<ScoredOffer> scored) {
    scored.sort(
        Comparator.comparingDouble(ScoredOffer::score)
            .reversed()
            .thenComparingLong(s -> s.offer().id()));
    var topScore = scored.getFirst().score();
    var tied = scored.stream().filter(s -> s.score() == topScore).toList();
    if (tied.size() == 1) {
      return tied.getFirst();
    }
    // Ties broken with the candidate's seeded RNG, split per-candidate so results are deterministic
    // regardless of the order in which candidates are resolved.
    var rng = rngs.forLeaguePhase(leagueId, phase).split(candidateId);
    var sortedTied = new ArrayList<>(tied);
    sortedTied.sort(Comparator.comparingLong(s -> s.offer().id()));
    var pick = (int) ((rng.nextLong() & Long.MAX_VALUE) % sortedTied.size());
    return sortedTied.get(pick);
  }

  private void upsertHired(LeaguePhase phase, long teamId, int weekAtResolve, long candidateId) {
    var existing = hiringStates.find(teamId, phase);
    hiringStates.upsert(
        new TeamHiringState(
            existing.map(TeamHiringState::id).orElse(0L),
            teamId,
            phase,
            HiringStep.HIRED,
            existing.map(TeamHiringState::shortlist).orElse(List.of()),
            existing.map(TeamHiringState::interviewingCandidateIds).orElse(List.of())));
    staff.insert(
        new NewTeamStaffMember(
            teamId, candidateId, staffRoleFor(phase), Optional.empty(), phase, weekAtResolve));
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

  private record ScoredOffer(CandidateOffer offer, double score) {}
}
