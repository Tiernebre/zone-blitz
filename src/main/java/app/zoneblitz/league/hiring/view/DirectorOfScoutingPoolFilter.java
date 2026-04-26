package app.zoneblitz.league.hiring.view;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Pure, in-memory filter/sort/paginate for the DoS candidate pool table. Mirrors {@link
 * HeadCoachPoolFilter}.
 */
final class DirectorOfScoutingPoolFilter {

  private DirectorOfScoutingPoolFilter() {}

  static DirectorOfScoutingPoolPage apply(
      List<DirectorOfScoutingCandidateView> all, DirectorOfScoutingPoolQuery query) {
    var filtered =
        all.stream().filter(row -> matches(row, query)).sorted(comparatorFor(query)).toList();
    var fromIndex = Math.min((query.page() - 1) * query.pageSize(), filtered.size());
    var toIndex = Math.min(fromIndex + query.pageSize(), filtered.size());
    return new DirectorOfScoutingPoolPage(
        filtered.subList(fromIndex, toIndex), all.size(), filtered.size(), query);
  }

  private static boolean matches(
      DirectorOfScoutingCandidateView row, DirectorOfScoutingPoolQuery q) {
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
      if (statusFilter.get() == DirectorOfScoutingPoolQuery.Status.INTERVIEWED && !interviewed) {
        return false;
      }
      if (statusFilter.get() == DirectorOfScoutingPoolQuery.Status.NOT_INTERVIEWED && interviewed) {
        return false;
      }
    }
    return true;
  }

  private static Comparator<DirectorOfScoutingCandidateView> comparatorFor(
      DirectorOfScoutingPoolQuery q) {
    Comparator<DirectorOfScoutingCandidateView> base =
        switch (q.sort()) {
          case NAME ->
              Comparator.comparing(
                  DirectorOfScoutingCandidateView::name, String.CASE_INSENSITIVE_ORDER);
          case ARCHETYPE ->
              Comparator.comparing(
                  row -> row.archetype().displayName(), String.CASE_INSENSITIVE_ORDER);
          case SPECIALTY -> Comparator.comparing(row -> row.specialty().name());
          case AGE -> Comparator.comparingInt(DirectorOfScoutingCandidateView::age);
          case DOS_YEARS -> Comparator.comparingInt(DirectorOfScoutingCandidateView::dosYears);
          case SCOUT_YEARS -> Comparator.comparingInt(DirectorOfScoutingCandidateView::scoutYears);
          case AREA_YEARS ->
              Comparator.comparingInt(DirectorOfScoutingCandidateView::areaScoutYears);
          case COMP -> Comparator.comparing(DirectorOfScoutingCandidateView::compensationTarget);
          case LENGTH ->
              Comparator.comparingInt(DirectorOfScoutingCandidateView::contractLengthTarget);
          case GUARANTEED ->
              Comparator.comparing(DirectorOfScoutingCandidateView::guaranteedMoneyTarget);
          case INTEREST -> Comparator.comparingInt(DirectorOfScoutingPoolFilter::interestRank);
        };
    return q.dir() == DirectorOfScoutingPoolQuery.SortDir.DESC ? base.reversed() : base;
  }

  private static int interestRank(DirectorOfScoutingCandidateView row) {
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
