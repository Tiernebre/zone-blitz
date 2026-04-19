package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.franchise.Franchise;
import app.zoneblitz.league.geography.City;
import app.zoneblitz.league.geography.State;
import app.zoneblitz.league.phase.LeaguePhase;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class LeagueTableFilterTests {

  private static final State MA = new State(1L, "MA", "Massachusetts");
  private static final State NY = new State(2L, "NY", "New York");

  private final LeagueSummary boston =
      league(
          1L,
          "Alpha",
          LeaguePhase.INITIAL_SETUP,
          Instant.parse("2025-01-01T00:00:00Z"),
          "Boston",
          "Minutemen",
          MA);
  private final LeagueSummary ny =
      league(
          2L,
          "Zeta",
          LeaguePhase.HIRING_HEAD_COACH,
          Instant.parse("2025-03-01T00:00:00Z"),
          "New York",
          "Empires",
          NY);
  private final LeagueSummary second =
      league(
          3L,
          "Bravo",
          LeaguePhase.COMPLETE,
          Instant.parse("2025-02-01T00:00:00Z"),
          "Boston",
          "Minutemen",
          MA);

  private final List<LeagueSummary> all = List.of(boston, ny, second);

  @Test
  void apply_withDefaults_sortsByCreatedAtDescending() {
    var page = LeagueTableFilter.apply(all, LeagueTableQuery.defaults());

    assertThat(page.rows()).extracting(LeagueSummary::leagueId).containsExactly(2L, 3L, 1L);
    assertThat(page.totalRows()).isEqualTo(3);
    assertThat(page.filteredRows()).isEqualTo(3);
  }

  @Test
  void apply_globalSearch_matchesNameOrFranchiseCaseInsensitive() {
    var query = query().withQ("empire").build();
    var page = LeagueTableFilter.apply(all, query);

    assertThat(page.rows()).extracting(LeagueSummary::leagueId).containsExactly(2L);
  }

  @Test
  void apply_phaseFilter_limitsToExactPhase() {
    var query = query().withPhase(LeaguePhase.COMPLETE.name()).build();
    var page = LeagueTableFilter.apply(all, query);

    assertThat(page.rows()).extracting(LeagueSummary::leagueId).containsExactly(3L);
  }

  @Test
  void apply_sortByName_ascending() {
    var query =
        query().withSort(LeagueTableQuery.SortKey.NAME, LeagueTableQuery.SortDir.ASC).build();
    var page = LeagueTableFilter.apply(all, query);

    assertThat(page.rows())
        .extracting(LeagueSummary::leagueName)
        .containsExactly("Alpha", "Bravo", "Zeta");
  }

  @Test
  void apply_pagination_returnsRequestedSlice() {
    var query =
        query()
            .withPage(2)
            .withPageSize(2)
            .withSort(LeagueTableQuery.SortKey.NAME, LeagueTableQuery.SortDir.ASC)
            .build();
    var page = LeagueTableFilter.apply(all, query);

    assertThat(page.rows()).extracting(LeagueSummary::leagueName).containsExactly("Zeta");
    assertThat(page.totalPages()).isEqualTo(2);
    assertThat(page.hasPrev()).isTrue();
    assertThat(page.hasNext()).isFalse();
  }

  @Test
  void apply_invalidPhaseString_isIgnored() {
    var query = query().withPhase("NONSENSE").build();
    var page = LeagueTableFilter.apply(all, query);

    assertThat(page.rows()).hasSize(3);
  }

  @Test
  void apply_filteredToEmpty_totalPagesIsOne() {
    var query = query().withQ("nomatch").build();
    var page = LeagueTableFilter.apply(all, query);

    assertThat(page.rows()).isEmpty();
    assertThat(page.totalPages()).isEqualTo(1);
  }

  private static QueryBuilder query() {
    return new QueryBuilder();
  }

  private static LeagueSummary league(
      long id,
      String name,
      LeaguePhase phase,
      Instant created,
      String cityName,
      String franchiseName,
      State state) {
    return new LeagueSummary(
        id,
        name,
        phase,
        1,
        created,
        100L + id,
        new Franchise(id, franchiseName, new City(id, cityName, state), "#000000", "#ffffff"));
  }

  private static final class QueryBuilder {
    private String q = "";
    private String name = "";
    private String franchise = "";
    private String phase = "";
    private LeagueTableQuery.SortKey sort = LeagueTableQuery.SortKey.CREATED_AT;
    private LeagueTableQuery.SortDir dir = LeagueTableQuery.SortDir.DESC;
    private int page = 1;
    private int pageSize = LeagueTableQuery.DEFAULT_PAGE_SIZE;

    QueryBuilder withQ(String v) {
      this.q = v;
      return this;
    }

    QueryBuilder withPhase(String v) {
      this.phase = v;
      return this;
    }

    QueryBuilder withSort(LeagueTableQuery.SortKey s, LeagueTableQuery.SortDir d) {
      this.sort = s;
      this.dir = d;
      return this;
    }

    QueryBuilder withPage(int p) {
      this.page = p;
      return this;
    }

    QueryBuilder withPageSize(int s) {
      this.pageSize = s;
      return this;
    }

    LeagueTableQuery build() {
      return new LeagueTableQuery(q, name, franchise, phase, sort, dir, page, pageSize);
    }
  }
}
