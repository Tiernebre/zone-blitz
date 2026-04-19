package app.zoneblitz.league.hiring;

import app.zoneblitz.league.LeagueSummary;
import app.zoneblitz.league.team.TeamProfile;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Assembles {@link HeadCoachCandidateView} rows and the composite {@link HeadCoachHiringView} from
 * domain candidates + preferences + team profile + per-team interview history + the requesting
 * team's active offers. The view is read-only: stance and directional hints are derived from the
 * stored offer stance and recomputed hint, not persisted separately in the view model.
 */
public final class HeadCoachHiringViewModel {

  private static final Pattern EXP_KEY_VALUE = Pattern.compile("\"([A-Z_]+)\"\\s*:\\s*(-?[0-9]+)");

  private HeadCoachHiringViewModel() {}

  static HeadCoachHiringView assemble(
      LeagueSummary league,
      List<Candidate> pool,
      List<CandidatePreferences> preferences,
      List<TeamInterview> interviews,
      List<CandidateOffer> teamOffers,
      Optional<TeamProfile> teamProfile,
      int interviewCapacity) {
    var prefsByCandidate =
        preferences.stream()
            .collect(
                java.util.stream.Collectors.toUnmodifiableMap(
                    CandidatePreferences::candidateId, p -> p));
    var interestByCandidate = interestByCandidate(interviews);
    var offerByCandidate =
        teamOffers.stream()
            .collect(
                java.util.stream.Collectors.toUnmodifiableMap(
                    CandidateOffer::candidateId, o -> o, (a, b) -> a));
    var interviewsToday = countForDay(interviews, league.phaseDay());
    var rows =
        pool.stream()
            .filter(c -> c.hiredByTeamId().isEmpty())
            .map(
                c ->
                    toRow(
                        c,
                        prefsByCandidate,
                        interestByCandidate,
                        offerByCandidate,
                        teamProfile.orElse(null)))
            .toList();
    var activeInterviewRows = rows.stream().filter(HeadCoachCandidateView::interviewed).toList();
    return new HeadCoachHiringView(
        league, rows, activeInterviewRows, interviewsToday, interviewCapacity);
  }

  private static Map<Long, InterviewInterest> interestByCandidate(List<TeamInterview> interviews) {
    var m = new HashMap<Long, InterviewInterest>();
    for (var i : interviews) {
      m.put(i.candidateId(), i.interestLevel());
    }
    return m;
  }

  private static int countForDay(List<TeamInterview> interviews, int phaseDay) {
    return (int) interviews.stream().filter(i -> i.phaseDay() == phaseDay).count();
  }

  private static HeadCoachCandidateView toRow(
      Candidate candidate,
      Map<Long, CandidatePreferences> prefsById,
      Map<Long, InterviewInterest> interestByCandidate,
      Map<Long, CandidateOffer> offerByCandidate,
      TeamProfile teamProfile) {
    var prefs = prefsById.get(candidate.id());
    var interest = Optional.ofNullable(interestByCandidate.get(candidate.id()));
    var offer =
        Optional.ofNullable(offerByCandidate.get(candidate.id()))
            .flatMap(o -> toOfferView(o, prefs, teamProfile));
    return new HeadCoachCandidateView(
        candidate.id(),
        candidate.fullName(),
        candidate.archetype(),
        candidate.specialtyPosition(),
        candidate.age(),
        candidate.totalExperienceYears(),
        experienceFor(candidate.experienceByRole(), "HC"),
        experienceFor(candidate.experienceByRole(), "OC"),
        experienceFor(candidate.experienceByRole(), "POSITION_COACH"),
        prefs == null ? BigDecimal.ZERO : prefs.compensationTarget(),
        prefs == null ? 0 : prefs.contractLengthTarget(),
        prefs == null ? BigDecimal.ZERO : prefs.guaranteedMoneyTarget(),
        interest,
        offer);
  }

  private static Optional<OfferView> toOfferView(
      CandidateOffer offer, CandidatePreferences prefs, TeamProfile teamProfile) {
    if (prefs == null || teamProfile == null) {
      return Optional.empty();
    }
    var terms = OfferTermsJson.fromJson(offer.terms());
    var stance = offer.stance().orElse(OfferStance.PENDING);
    var hint =
        stance == OfferStance.PENDING
            ? Optional.<String>empty()
            : StanceEvaluator.evaluate(terms, teamProfile, prefs).hint();
    return Optional.of(
        new OfferView(
            offer.id(),
            terms.compensation(),
            terms.contractLengthYears(),
            terms.guaranteedMoneyPct(),
            terms.roleScope(),
            terms.staffContinuity(),
            stance,
            offer.revisionCount(),
            StanceEvaluator.REVISION_CAP,
            hint));
  }

  private static int experienceFor(String experienceByRoleJson, String role) {
    var m = EXP_KEY_VALUE.matcher(experienceByRoleJson);
    while (m.find()) {
      if (m.group(1).equals(role)) {
        try {
          return Integer.parseInt(m.group(2));
        } catch (NumberFormatException e) {
          return 0;
        }
      }
    }
    return 0;
  }
}
