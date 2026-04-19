package app.zoneblitz.league;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Assembles {@link DirectorOfScoutingCandidateView} rows and the composite {@link
 * DirectorOfScoutingHiringView}. Mirrors {@link HeadCoachHiringViewModel} for the DoS phase — only
 * the experience-by-role keys (DOS / SCOUT / AREA_SCOUT) differ.
 */
final class DirectorOfScoutingHiringViewModel {

  private static final Pattern OVERALL =
      Pattern.compile("\"overall\"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?)");
  private static final Pattern EXP_KEY_VALUE = Pattern.compile("\"([A-Z_]+)\"\\s*:\\s*(-?[0-9]+)");

  private DirectorOfScoutingHiringViewModel() {}

  static DirectorOfScoutingHiringView assemble(
      LeagueSummary league,
      List<Candidate> pool,
      List<CandidatePreferences> preferences,
      List<Long> shortlist,
      List<FranchiseInterview> interviews,
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
            .filter(c -> c.hiredByFranchiseId().isEmpty())
            .map(c -> toRow(c, prefsByCandidate, shortlistSet, interviewCounts, latestScouted))
            .toList();
    var shortlistRows = rows.stream().filter(DirectorOfScoutingCandidateView::shortlisted).toList();
    var activeInterviewRows = rows.stream().filter(r -> r.interviewCount() > 0).toList();
    return new DirectorOfScoutingHiringView(
        league, rows, shortlistRows, activeInterviewRows, interviewsThisWeek, interviewCapacity);
  }

  private static Map<Long, Integer> countsByCandidate(List<FranchiseInterview> interviews) {
    return interviews.stream()
        .collect(
            java.util.stream.Collectors.groupingBy(
                FranchiseInterview::candidateId,
                java.util.stream.Collectors.reducing(0, ignored -> 1, Integer::sum)));
  }

  private static Map<Long, BigDecimal> latestScoutedByCandidate(
      List<FranchiseInterview> interviews) {
    return interviews.stream()
        .collect(
            java.util.stream.Collectors.toMap(
                FranchiseInterview::candidateId,
                FranchiseInterview::scoutedOverall,
                (earlier, later) -> later));
  }

  private static int countForWeek(List<FranchiseInterview> interviews, int phaseWeek) {
    return (int) interviews.stream().filter(i -> i.phaseWeek() == phaseWeek).count();
  }

  private static DirectorOfScoutingCandidateView toRow(
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
    return new DirectorOfScoutingCandidateView(
        candidate.id(),
        candidate.archetype(),
        candidate.specialtyPosition(),
        candidate.age(),
        candidate.totalExperienceYears(),
        experienceFor(candidate.experienceByRole(), "DOS"),
        experienceFor(candidate.experienceByRole(), "SCOUT"),
        experienceFor(candidate.experienceByRole(), "AREA_SCOUT"),
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
