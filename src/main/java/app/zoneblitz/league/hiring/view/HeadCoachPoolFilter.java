package app.zoneblitz.league.hiring.view;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Pure, in-memory filter/sort/paginate for the HC candidate pool table. Pool sizes per league are
 * small (tens), so doing this in-memory over the already-loaded view keeps the assembly layer
 * untouched. Mirrors {@code LeagueTableFilter}.
 */
final class HeadCoachPoolFilter {

  private HeadCoachPoolFilter() {}

  static HeadCoachPoolPage apply(List<HeadCoachCandidateView> all, HeadCoachPoolQuery query) {
    var filtered =
        all.stream().filter(row -> matches(row, query)).sorted(comparatorFor(query)).toList();
    var fromIndex = Math.min((query.page() - 1) * query.pageSize(), filtered.size());
    var toIndex = Math.min(fromIndex + query.pageSize(), filtered.size());
    return new HeadCoachPoolPage(
        filtered.subList(fromIndex, toIndex), all.size(), filtered.size(), query);
  }

  private static boolean matches(HeadCoachCandidateView row, HeadCoachPoolQuery q) {
    if (!q.q().isEmpty()) {
      var needle = q.q().toLowerCase(Locale.ROOT);
      var nameHit = row.name().toLowerCase(Locale.ROOT).contains(needle);
      var archetypeHit =
          row.archetype().displayName().toLowerCase(Locale.ROOT).contains(needle)
              || row.archetype().name().toLowerCase(Locale.ROOT).contains(needle);
      var specialtyHit = row.specialty().name().toLowerCase(Locale.ROOT).contains(needle);
      if (!(nameHit || archetypeHit || specialtyHit)) {
        return false;
      }
    }
    var archetypeFilter = q.archetypeFilter();
    if (archetypeFilter.isPresent() && row.archetype() != archetypeFilter.get()) {
      return false;
    }
    var specialtyFilter = q.specialtyFilter();
    if (specialtyFilter.isPresent() && row.specialty() != specialtyFilter.get()) {
      return false;
    }
    var statusFilter = q.statusFilter();
    if (statusFilter.isPresent()) {
      var interviewed = row.interviewed();
      if (statusFilter.get() == HeadCoachPoolQuery.Status.INTERVIEWED && !interviewed) {
        return false;
      }
      if (statusFilter.get() == HeadCoachPoolQuery.Status.NOT_INTERVIEWED && interviewed) {
        return false;
      }
    }
    return true;
  }

  private static Comparator<HeadCoachCandidateView> comparatorFor(HeadCoachPoolQuery q) {
    Comparator<HeadCoachCandidateView> base =
        switch (q.sort()) {
          case NAME ->
              Comparator.comparing(HeadCoachCandidateView::name, String.CASE_INSENSITIVE_ORDER);
          case ARCHETYPE ->
              Comparator.comparing(
                  row -> row.archetype().displayName(), String.CASE_INSENSITIVE_ORDER);
          case SPECIALTY -> Comparator.comparing(row -> row.specialty().name());
          case AGE -> Comparator.comparingInt(HeadCoachCandidateView::age);
          case HC_YEARS -> Comparator.comparingInt(HeadCoachCandidateView::hcYears);
          case COORD_YEARS -> Comparator.comparingInt(HeadCoachCandidateView::coordinatorYears);
          case POS_COACH_YEARS ->
              Comparator.comparingInt(HeadCoachCandidateView::positionCoachYears);
          case COMP -> Comparator.comparing(HeadCoachCandidateView::compensationTarget);
          case LENGTH -> Comparator.comparingInt(HeadCoachCandidateView::contractLengthTarget);
          case GUARANTEED -> Comparator.comparing(HeadCoachCandidateView::guaranteedMoneyTarget);
          case INTEREST -> Comparator.comparingInt(HeadCoachPoolFilter::interestRank);
        };
    return q.dir() == HeadCoachPoolQuery.SortDir.DESC ? base.reversed() : base;
  }

  private static int interestRank(HeadCoachCandidateView row) {
    if (row.interest().isEmpty()) {
      return Integer.MAX_VALUE;
    }
    return switch (row.interest().get()) {
      case INTERESTED -> 0;
      case LUKEWARM -> 1;
      case NOT_INTERESTED -> 2;
    };
  }
}
