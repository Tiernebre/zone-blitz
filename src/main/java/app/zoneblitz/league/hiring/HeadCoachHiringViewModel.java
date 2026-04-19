package app.zoneblitz.league;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Assembles {@link HeadCoachCandidateView} rows and the composite {@link HeadCoachHiringView} from
 * domain candidates + preferences + shortlist state + per-team interview history. Extracted from
 * the controller so the controller stays thin and the assembly logic is unit-testable on its own.
 */
final class HeadCoachHiringViewModel {

  private static final Pattern OVERALL =
      Pattern.compile("\"overall\"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)");
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
    var interviewCounts = countsByCandidate(interviews);
    var latestScouted = latestScoutedByCandidate(interviews);
    var interviewsThisWeek = countForWeek(interviews, league.phaseWeek());
    var rows =
        pool.stream()
            .filter(c -> c.hiredByTeamId().isEmpty())
            .map(c -> toRow(c, prefsByCandidate, shortlistSet, interviewCounts, latestScouted))
            .toList();
    var shortlistRows = rows.stream().filter(HeadCoachCandidateView::shortlisted).toList();
    var activeInterviewRows = rows.stream().filter(r -> r.interviewCount() > 0).toList();
    return new HeadCoachHiringView(
        league, rows, shortlistRows, activeInterviewRows, interviewsThisWeek, interviewCapacity);
  }

  private static Map<Long, Integer> countsByCandidate(List<TeamInterview> interviews) {
    return interviews.stream()
        .collect(
            java.util.stream.Collectors.groupingBy(
                TeamInterview::candidateId,
                java.util.stream.Collectors.reducing(0, ignored -> 1, Integer::sum)));
  }

  private static Map<Long, BigDecimal> latestScoutedByCandidate(List<TeamInterview> interviews) {
    return interviews.stream()
        .collect(
            java.util.stream.Collectors.toMap(
                TeamInterview::candidateId,
                TeamInterview::scoutedOverall,
                (earlier, later) -> later));
  }

  private static int countForWeek(List<TeamInterview> interviews, int phaseWeek) {
    return (int) interviews.stream().filter(i -> i.phaseWeek() == phaseWeek).count();
  }

  private static HeadCoachCandidateView toRow(
      Candidate candidate,
      Map<Long, CandidatePreferences> prefsById,
      Set<Long> shortlistSet,
      Map<Long, Integer> interviewCounts,
      Map<Long, BigDecimal> latestScouted) {
    var prefs = prefsById.get(candidate.id());
    var count = interviewCounts.getOrDefault(candidate.id(), 0);
    var scoutedOverall =
        latestScouted.containsKey(candidate.id())
            ? "%.1f".formatted(latestScouted.get(candidate.id()).doubleValue())
            : extractOverall(candidate.scoutedAttrs());
    return new HeadCoachCandidateView(
        candidate.id(),
        candidate.archetype(),
        candidate.specialtyPosition(),
        candidate.age(),
        candidate.totalExperienceYears(),
        experienceFor(candidate.experienceByRole(), "HC"),
        experienceFor(candidate.experienceByRole(), "OC"),
        experienceFor(candidate.experienceByRole(), "POSITION_COACH"),
        scoutedOverall,
        prefs == null ? BigDecimal.ZERO : prefs.compensationTarget(),
        prefs == null ? 0 : prefs.contractLengthTarget(),
        prefs == null ? BigDecimal.ZERO : prefs.guaranteedMoneyTarget(),
        shortlistSet.contains(candidate.id()),
        count);
  }

  private static String extractOverall(String scoutedAttrsJson) {
    var m = OVERALL.matcher(scoutedAttrsJson);
    if (m.find()) {
      try {
        var val = Double.parseDouble(m.group(1));
        return "%.1f".formatted(val);
      } catch (NumberFormatException e) {
        return "?";
      }
    }
    return "?";
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
