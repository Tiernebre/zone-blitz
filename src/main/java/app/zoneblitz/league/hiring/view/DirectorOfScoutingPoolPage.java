package app.zoneblitz.league.hiring.view;

import java.util.List;
import java.util.Objects;

/**
 * A slice of the DoS candidate pool for a given {@link DirectorOfScoutingPoolQuery}. Mirrors {@link
 * HeadCoachPoolPage}.
 */
record DirectorOfScoutingPoolPage(
    List<DirectorOfScoutingCandidateView> rows,
    int totalRows,
    int filteredRows,
    DirectorOfScoutingPoolQuery query) {

  DirectorOfScoutingPoolPage {
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
