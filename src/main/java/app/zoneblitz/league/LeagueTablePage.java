package app.zoneblitz.league;

import java.util.List;
import java.util.Objects;

/**
 * A slice of the leagues table for a given {@link LeagueTableQuery}: the filtered, sorted, and
 * paginated rows plus the totals needed to render pagination controls.
 */
public record LeagueTablePage(
    List<LeagueSummary> rows, int totalRows, int filteredRows, LeagueTableQuery query) {

  public LeagueTablePage {
    Objects.requireNonNull(query, "query");
    rows = List.copyOf(rows);
  }

  public int totalPages() {
    if (filteredRows == 0) {
      return 1;
    }
    return (filteredRows + query.pageSize() - 1) / query.pageSize();
  }

  public boolean hasPrev() {
    return query.page() > 1;
  }

  public boolean hasNext() {
    return query.page() < totalPages();
  }
}
