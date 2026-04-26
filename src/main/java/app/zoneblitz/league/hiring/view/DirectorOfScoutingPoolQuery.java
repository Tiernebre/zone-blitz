package app.zoneblitz.league.hiring.view;

import app.zoneblitz.league.hiring.CandidateArchetype;
import app.zoneblitz.league.staff.SpecialtyPosition;
import java.util.Objects;
import java.util.Optional;

/**
 * Querystring-bound parameters for the Director-of-Scouting candidate pool table. Mirrors {@link
 * HeadCoachPoolQuery}; sort keys differ to reflect the DoS-specific experience columns (DoS years,
 * Scout years, Area-scout years).
 */
record DirectorOfScoutingPoolQuery(
    String q,
    String archetype,
    String specialty,
    String status,
    SortKey sort,
    SortDir dir,
    int page,
    int pageSize) {

  public static final int DEFAULT_PAGE_SIZE = 10;
  public static final int MAX_PAGE_SIZE = 100;

  public enum SortKey {
    NAME,
    ARCHETYPE,
    SPECIALTY,
    AGE,
    DOS_YEARS,
    SCOUT_YEARS,
    AREA_YEARS,
    COMP,
    LENGTH,
    GUARANTEED,
    INTEREST
  }

  public enum SortDir {
    ASC,
    DESC
  }

  public enum Status {
    INTERVIEWED("Interviewed"),
    NOT_INTERVIEWED("Not interviewed");

    private final String displayName;

    Status(String displayName) {
      this.displayName = displayName;
    }

    public String displayName() {
      return displayName;
    }
  }

  DirectorOfScoutingPoolQuery {
    q = nullToEmpty(q).trim();
    archetype = nullToEmpty(archetype).trim();
    specialty = nullToEmpty(specialty).trim();
    status = nullToEmpty(status).trim();
    sort = Objects.requireNonNullElse(sort, SortKey.NAME);
    dir = Objects.requireNonNullElse(dir, SortDir.ASC);
    page = Math.max(1, page);
    pageSize = pageSize <= 0 ? DEFAULT_PAGE_SIZE : Math.min(pageSize, MAX_PAGE_SIZE);
  }

  public static DirectorOfScoutingPoolQuery defaults() {
    return new DirectorOfScoutingPoolQuery(
        "", "", "", "", SortKey.NAME, SortDir.ASC, 1, DEFAULT_PAGE_SIZE);
  }

  public Optional<CandidateArchetype> archetypeFilter() {
    if (archetype.isEmpty()) {
      return Optional.empty();
    }
    try {
      return Optional.of(CandidateArchetype.valueOf(archetype));
    } catch (IllegalArgumentException ignored) {
      return Optional.empty();
    }
  }

  public Optional<SpecialtyPosition> specialtyFilter() {
    if (specialty.isEmpty()) {
      return Optional.empty();
    }
    try {
      return Optional.of(SpecialtyPosition.valueOf(specialty));
    } catch (IllegalArgumentException ignored) {
      return Optional.empty();
    }
  }

  public Optional<Status> statusFilter() {
    if (status.isEmpty()) {
      return Optional.empty();
    }
    try {
      return Optional.of(Status.valueOf(status));
    } catch (IllegalArgumentException ignored) {
      return Optional.empty();
    }
  }

  private static String nullToEmpty(String s) {
    return s == null ? "" : s;
  }
}
