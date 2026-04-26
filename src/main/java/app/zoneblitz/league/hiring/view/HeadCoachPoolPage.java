package app.zoneblitz.league.hiring.view;

import java.util.List;
import java.util.Objects;

/**
 * A slice of the HC candidate pool for a given {@link HeadCoachPoolQuery}: the filtered, sorted,
 * and paginated rows plus the totals needed to render pagination controls. Mirrors {@code
 * LeagueTablePage}.
 */
record HeadCoachPoolPage(
    List<HeadCoachCandidateView> rows, int totalRows, int filteredRows, HeadCoachPoolQuery query) {

  HeadCoachPoolPage {
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
