package app.zoneblitz.league.hiring;

import app.zoneblitz.league.LeagueSummary;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Assembles {@link HeadCoachCandidateView} rows and the composite {@link HeadCoachHiringView} from
 * domain candidates + preferences + shortlist state + per-team interview history. Extracted from
 * the controller so the controller stays thin and the assembly logic is unit-testable on its own.
 */
public final class HeadCoachHiringViewModel {

  private static final Pattern EXP_KEY_VALUE = Pattern.compile("\"([A-Z_]+)\"\\s*:\\s*(-?[0-9]+)");

  private HeadCoachHiringViewModel() {}

  static HeadCoachHiringView assemble(
      LeagueSummary league,
      List<Candidate> pool,
      List<CandidatePreferences> preferences,
      List<Long> shortlist,
      List<TeamInterview> interviews,
      int interviewCapacity) {
    var prefsByCandidate =
        preferences.stream()
            .collect(
                java.util.stream.Collectors.toUnmodifiableMap(
                    CandidatePreferences::candidateId, p -> p));
    var shortlistSet = Set.copyOf(shortlist);
    var interestByCandidate = interestByCandidate(interviews);
    var interviewsThisWeek = countForWeek(interviews, league.phaseWeek());
    var rows =
        pool.stream()
            .filter(c -> c.hiredByTeamId().isEmpty())
            .map(c -> toRow(c, prefsByCandidate, shortlistSet, interestByCandidate))
            .toList();
    var shortlistRows = rows.stream().filter(HeadCoachCandidateView::shortlisted).toList();
    var activeInterviewRows = rows.stream().filter(HeadCoachCandidateView::interviewed).toList();
    return new HeadCoachHiringView(
        league, rows, shortlistRows, activeInterviewRows, interviewsThisWeek, interviewCapacity);
  }

  private static Map<Long, InterviewInterest> interestByCandidate(List<TeamInterview> interviews) {
    var m = new HashMap<Long, InterviewInterest>();
    for (var i : interviews) {
      m.put(i.candidateId(), i.interestLevel());
    }
    return m;
  }

  private static int countForWeek(List<TeamInterview> interviews, int phaseWeek) {
    return (int) interviews.stream().filter(i -> i.phaseWeek() == phaseWeek).count();
  }

  private static HeadCoachCandidateView toRow(
      Candidate candidate,
      Map<Long, CandidatePreferences> prefsById,
      Set<Long> shortlistSet,
      Map<Long, InterviewInterest> interestByCandidate) {
    var prefs = prefsById.get(candidate.id());
    var interest = Optional.ofNullable(interestByCandidate.get(candidate.id()));
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
        shortlistSet.contains(candidate.id()),
        interest);
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
