package app.zoneblitz.league;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Pure, in-memory filter/sort/paginate for the home-page leagues table. Pool sizes per user are
 * small (tens, low hundreds at the tail), so doing this in-memory over the already-loaded summary
 * list keeps the query layer untouched while proving the HTMX table pattern.
 */
final class LeagueTableFilter {

  private LeagueTableFilter() {}

  static LeagueTablePage apply(List<LeagueSummary> all, LeagueTableQuery query) {
    var filtered =
        all.stream().filter(row -> matches(row, query)).sorted(comparatorFor(query)).toList();
    var fromIndex = Math.min((query.page() - 1) * query.pageSize(), filtered.size());
    var toIndex = Math.min(fromIndex + query.pageSize(), filtered.size());
    return new LeagueTablePage(
        filtered.subList(fromIndex, toIndex), all.size(), filtered.size(), query);
  }

  private static boolean matches(LeagueSummary row, LeagueTableQuery q) {
    var franchiseDisplay = franchiseDisplay(row);
    if (!q.q().isEmpty()) {
      var needle = q.q().toLowerCase(Locale.ROOT);
      var nameHit = row.leagueName().toLowerCase(Locale.ROOT).contains(needle);
      var franchiseHit = franchiseDisplay.toLowerCase(Locale.ROOT).contains(needle);
      var phaseHit =
          row.phase().name().toLowerCase(Locale.ROOT).contains(needle)
              || row.phase().displayName().toLowerCase(Locale.ROOT).contains(needle);
      if (!(nameHit || franchiseHit || phaseHit)) {
        return false;
      }
    }
    if (!q.name().isEmpty()
        && !row.leagueName().toLowerCase(Locale.ROOT).contains(q.name().toLowerCase(Locale.ROOT))) {
      return false;
    }
    if (!q.franchise().isEmpty()
        && !franchiseDisplay
            .toLowerCase(Locale.ROOT)
            .contains(q.franchise().toLowerCase(Locale.ROOT))) {
      return false;
    }
    var phaseFilter = q.phaseFilter();
    if (phaseFilter.isPresent() && row.phase() != phaseFilter.get()) {
      return false;
    }
    return true;
  }

  private static Comparator<LeagueSummary> comparatorFor(LeagueTableQuery q) {
    Comparator<LeagueSummary> base =
        switch (q.sort()) {
          case NAME ->
              Comparator.comparing(LeagueSummary::leagueName, String.CASE_INSENSITIVE_ORDER);
          case FRANCHISE ->
              Comparator.comparing(
                  LeagueTableFilter::franchiseDisplay, String.CASE_INSENSITIVE_ORDER);
          case PHASE -> Comparator.comparing(row -> row.phase().ordinal());
          case CREATED_AT -> Comparator.comparing(LeagueSummary::createdAt);
        };
    return q.dir() == LeagueTableQuery.SortDir.DESC ? base.reversed() : base;
  }

  static String franchiseDisplay(LeagueSummary row) {
    return row.userFranchise().city().name() + " " + row.userFranchise().name();
  }
}
