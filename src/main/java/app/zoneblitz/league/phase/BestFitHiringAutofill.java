package app.zoneblitz.league.phase;

import app.zoneblitz.league.hiring.Candidate;
import app.zoneblitz.league.hiring.CandidateOfferRepository;
import app.zoneblitz.league.hiring.CandidatePoolRepository;
import app.zoneblitz.league.hiring.CandidatePoolType;
import app.zoneblitz.league.hiring.CandidatePreferences;
import app.zoneblitz.league.hiring.CandidatePreferencesRepository;
import app.zoneblitz.league.hiring.CandidateRandomSources;
import app.zoneblitz.league.hiring.CandidateRepository;
import app.zoneblitz.league.hiring.InterestScoring;
import app.zoneblitz.league.hiring.OfferStatus;
import app.zoneblitz.league.hiring.OfferTerms;
import app.zoneblitz.league.hiring.OfferTermsJson;
import app.zoneblitz.league.hiring.PreferenceScoringOfferResolver;
import app.zoneblitz.league.staff.NewTeamStaffMember;
import app.zoneblitz.league.staff.StaffRole;
import app.zoneblitz.league.staff.TeamStaffMember;
import app.zoneblitz.league.staff.TeamStaffRepository;
import app.zoneblitz.league.team.TeamHiringState;
import app.zoneblitz.league.team.TeamHiringStateRepository;
import app.zoneblitz.league.team.TeamLookup;
import app.zoneblitz.league.team.TeamProfile;
import app.zoneblitz.league.team.TeamProfiles;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Default {@link HiringPhaseAutofill}: ranks remaining candidates per-team by preference-fit score
 * and assigns the top fit to each unresolved team. Hidden ratings are never consulted — same rule
 * as {@link app.zoneblitz.league.hiring.CpuHiringStrategy}. Ties are broken first by candidate id,
 * then — if still tied — by a deterministic seeded RNG split per-team.
 *
 * <p>Default terms mirror the candidate's preference targets so the synthetic offer scores a
 * perfect fit. The hire wiring (mark candidate hired, upsert hiring state to {@link
 * HiringStep#HIRED}, insert {@link TeamStaffMember}, create an {@link OfferStatus#ACCEPTED} offer
 * row) matches the flow in {@link PreferenceScoringOfferResolver}.
 */
@Component
public class BestFitHiringAutofill implements HiringPhaseAutofill {

  private static final Logger log = LoggerFactory.getLogger(BestFitHiringAutofill.class);

  private final CandidatePoolRepository pools;
  private final CandidateRepository candidates;
  private final CandidatePreferencesRepository preferences;
  private final CandidateOfferRepository offers;
  private final TeamHiringStateRepository hiringStates;
  private final TeamStaffRepository staff;
  private final TeamLookup teams;
  private final TeamProfiles teamProfiles;
  private final CandidateRandomSources rngs;

  public BestFitHiringAutofill(
      CandidatePoolRepository pools,
      CandidateRepository candidates,
      CandidatePreferencesRepository preferences,
      CandidateOfferRepository offers,
      TeamHiringStateRepository hiringStates,
      TeamStaffRepository staff,
      TeamLookup teams,
      TeamProfiles teamProfiles,
      CandidateRandomSources rngs) {
    this.pools = pools;
    this.candidates = candidates;
    this.preferences = preferences;
    this.offers = offers;
    this.hiringStates = hiringStates;
    this.staff = staff;
    this.teams = teams;
    this.teamProfiles = teamProfiles;
    this.rngs = rngs;
  }

  @Override
  public void autofill(long leagueId, LeaguePhase phase, int phaseWeek) {
    var maybePoolType = poolTypeFor(phase);
    if (maybePoolType.isEmpty()) {
      return;
    }
    var maybePool = pools.findByLeaguePhaseAndType(leagueId, phase, maybePoolType.get());
    if (maybePool.isEmpty()) {
      return;
    }
    var role = roleFor(phase);

    var remaining =
        new ArrayList<>(
            candidates.findAllByPoolId(maybePool.get().id()).stream()
                .filter(c -> c.hiredByTeamId().isEmpty())
                .toList());

    for (var teamId : teams.teamIdsForLeague(leagueId)) {
      if (isAlreadyHired(teamId, phase)) {
        continue;
      }
      if (remaining.isEmpty()) {
        log.warn(
            "autofill ran out of candidates leagueId={} phase={} teamId={}",
            leagueId,
            phase,
            teamId);
        return;
      }
      var maybeProfile = teamProfiles.forTeam(teamId);
      if (maybeProfile.isEmpty()) {
        log.warn("autofill skipped — missing team profile leagueId={} teamId={}", leagueId, teamId);
        continue;
      }
      var pick = pickBestFit(leagueId, phase, teamId, remaining, maybeProfile.get());
      if (pick.isEmpty()) {
        continue;
      }
      remaining.remove(pick.get());
      assign(leagueId, phase, phaseWeek, teamId, pick.get(), role);
    }
  }

  private boolean isAlreadyHired(long teamId, LeaguePhase phase) {
    return hiringStates.find(teamId, phase).map(s -> s.step() == HiringStep.HIRED).orElse(false);
  }

  private Optional<Candidate> pickBestFit(
      long leagueId,
      LeaguePhase phase,
      long teamId,
      List<Candidate> remaining,
      TeamProfile profile) {
    record Scored(Candidate candidate, double fit) {}
    var scored = new ArrayList<Scored>();
    for (var c : remaining) {
      var prefs = preferences.findByCandidateId(c.id());
      if (prefs.isEmpty()) {
        continue;
      }
      scored.add(new Scored(c, InterestScoring.normalizedScore(profile, prefs.get())));
    }
    if (scored.isEmpty()) {
      return Optional.empty();
    }
    scored.sort(
        Comparator.comparingDouble(Scored::fit)
            .reversed()
            .thenComparingLong(s -> s.candidate().id()));
    var topFit = scored.getFirst().fit();
    var tied = scored.stream().filter(s -> s.fit() == topFit).toList();
    if (tied.size() == 1) {
      return Optional.of(tied.getFirst().candidate());
    }
    var rng = rngs.forLeaguePhase(leagueId, phase).split(teamId);
    var pickIndex = (int) Math.floorMod(rng.nextLong(), (long) tied.size());
    return Optional.of(tied.get(pickIndex).candidate());
  }

  private void assign(
      long leagueId,
      LeaguePhase phase,
      int phaseWeek,
      long teamId,
      Candidate candidate,
      StaffRole role) {
    var maybePrefs = preferences.findByCandidateId(candidate.id());
    if (maybePrefs.isEmpty()) {
      log.warn(
          "autofill skipped — missing preferences leagueId={} candidateId={}",
          leagueId,
          candidate.id());
      return;
    }
    var terms = defaultTerms(maybePrefs.get());
    var offer =
        offers.insertActive(candidate.id(), teamId, OfferTermsJson.toJson(terms), phaseWeek);
    offers.resolve(offer.id(), OfferStatus.ACCEPTED);
    candidates.markHired(candidate.id(), teamId);
    upsertHired(teamId, phase);
    staff.insert(
        new NewTeamStaffMember(teamId, candidate.id(), role, Optional.empty(), phase, phaseWeek));
    log.info(
        "autofill hire leagueId={} phase={} teamId={} candidateId={} week={}",
        leagueId,
        phase,
        teamId,
        candidate.id(),
        phaseWeek);
  }

  private void upsertHired(long teamId, LeaguePhase phase) {
    var existing = hiringStates.find(teamId, phase);
    hiringStates.upsert(
        new TeamHiringState(
            existing.map(TeamHiringState::id).orElse(0L),
            teamId,
            phase,
            HiringStep.HIRED,
            existing.map(TeamHiringState::shortlist).orElse(List.of()),
            existing.map(TeamHiringState::interviewingCandidateIds).orElse(List.of())));
  }

  private static OfferTerms defaultTerms(CandidatePreferences prefs) {
    return new OfferTerms(
        prefs.compensationTarget(),
        prefs.contractLengthTarget(),
        prefs.guaranteedMoneyTarget(),
        prefs.roleScopeTarget(),
        prefs.staffContinuityTarget());
  }

  private static Optional<CandidatePoolType> poolTypeFor(LeaguePhase phase) {
    return switch (phase) {
      case HIRING_HEAD_COACH -> Optional.of(CandidatePoolType.HEAD_COACH);
      case HIRING_DIRECTOR_OF_SCOUTING -> Optional.of(CandidatePoolType.DIRECTOR_OF_SCOUTING);
      case INITIAL_SETUP, ASSEMBLING_STAFF, COMPLETE -> Optional.empty();
    };
  }

  private static StaffRole roleFor(LeaguePhase phase) {
    return switch (phase) {
      case HIRING_HEAD_COACH -> StaffRole.HEAD_COACH;
      case HIRING_DIRECTOR_OF_SCOUTING -> StaffRole.DIRECTOR_OF_SCOUTING;
      case INITIAL_SETUP, ASSEMBLING_STAFF, COMPLETE ->
          throw new IllegalArgumentException("no hire role for phase " + phase);
    };
  }
}
