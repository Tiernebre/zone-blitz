package app.zoneblitz.league;

import app.zoneblitz.league.phase.LeaguePhase;
import java.util.Objects;

/**
 * Querystring-bound parameters for the home-page leagues table. Every field is non-null and
 * canonicalized in the compact constructor so callers can pass user input as-is. Empty strings
 * represent "no filter"; {@link #phase()} is empty when no phase filter is active.
 *
 * <p>Used by the page endpoint (to render initial state from a bookmarked URL) and the fragment
 * endpoint (to re-render the table on filter/sort/paginate interactions).
 */
public record LeagueTableQuery(
    String q,
    String name,
    String franchise,
    String phase,
    SortKey sort,
    SortDir dir,
    int page,
    int pageSize) {

  public static final int DEFAULT_PAGE_SIZE = 10;
  public static final int MAX_PAGE_SIZE = 100;

  public enum SortKey {
    NAME,
    FRANCHISE,
    PHASE,
    CREATED_AT
  }

  public enum SortDir {
    ASC,
    DESC
  }

  public LeagueTableQuery {
    q = nullToEmpty(q).trim();
    name = nullToEmpty(name).trim();
    franchise = nullToEmpty(franchise).trim();
    phase = nullToEmpty(phase).trim();
    sort = Objects.requireNonNullElse(sort, SortKey.CREATED_AT);
    dir = Objects.requireNonNullElse(dir, sort == SortKey.CREATED_AT ? SortDir.DESC : SortDir.ASC);
    page = Math.max(1, page);
    pageSize = pageSize <= 0 ? DEFAULT_PAGE_SIZE : Math.min(pageSize, MAX_PAGE_SIZE);
  }

  public static LeagueTableQuery defaults() {
    return new LeagueTableQuery(
        "", "", "", "", SortKey.CREATED_AT, SortDir.DESC, 1, DEFAULT_PAGE_SIZE);
  }

  public java.util.Optional<LeaguePhase> phaseFilter() {
    if (phase.isEmpty()) {
      return java.util.Optional.empty();
    }
    try {
      return java.util.Optional.of(LeaguePhase.valueOf(phase));
    } catch (IllegalArgumentException ignored) {
      return java.util.Optional.empty();
    }
  }

  private static String nullToEmpty(String s) {
    return s == null ? "" : s;
  }
}
