package app.zoneblitz.league;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Assembles {@link HeadCoachCandidateView} rows and the composite {@link HeadCoachHiringView} from
 * domain candidates + preferences + shortlist state. Extracted from the controller so the
 * controller stays thin and the assembly logic is unit-testable on its own.
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
      List<Long> shortlist) {
    var prefsByCandidate =
        preferences.stream()
            .collect(
                java.util.stream.Collectors.toUnmodifiableMap(
                    CandidatePreferences::candidateId, p -> p));
    var shortlistSet = Set.copyOf(shortlist);
    var rows =
        pool.stream()
            .filter(c -> c.hiredByFranchiseId().isEmpty())
            .map(c -> toRow(c, prefsByCandidate, shortlistSet))
            .toList();
    var shortlistRows = rows.stream().filter(HeadCoachCandidateView::shortlisted).toList();
    return new HeadCoachHiringView(league, rows, shortlistRows);
  }

  private static HeadCoachCandidateView toRow(
      Candidate candidate,
      java.util.Map<Long, CandidatePreferences> prefsById,
      Set<Long> shortlistSet) {
    var prefs = prefsById.get(candidate.id());
    return new HeadCoachCandidateView(
        candidate.id(),
        candidate.archetype(),
        candidate.specialtyPosition(),
        candidate.age(),
        candidate.totalExperienceYears(),
        experienceFor(candidate.experienceByRole(), "HC"),
        experienceFor(candidate.experienceByRole(), "OC"),
        experienceFor(candidate.experienceByRole(), "POSITION_COACH"),
        extractOverall(candidate.scoutedAttrs()),
        prefs == null ? BigDecimal.ZERO : prefs.compensationTarget(),
        prefs == null ? 0 : prefs.contractLengthTarget(),
        prefs == null ? BigDecimal.ZERO : prefs.guaranteedMoneyTarget(),
        shortlistSet.contains(candidate.id()));
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
