package app.zoneblitz.league.hiring.view;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.hiring.CandidateArchetype;
import app.zoneblitz.league.hiring.InterviewInterest;
import app.zoneblitz.league.staff.SpecialtyPosition;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class HeadCoachPoolFilterTests {

  private final HeadCoachCandidateView aaron =
      candidate(1L, "Aaron Tactician", CandidateArchetype.TACTICIAN, SpecialtyPosition.QB, 52, 8)
          .withInterest(InterviewInterest.INTERESTED)
          .build();
  private final HeadCoachCandidateView blake =
      candidate(2L, "Blake CEO", CandidateArchetype.CEO, SpecialtyPosition.LB, 60, 12).build();
  private final HeadCoachCandidateView casey =
      candidate(
              3L,
              "Casey Caller",
              CandidateArchetype.OFFENSIVE_PLAY_CALLER,
              SpecialtyPosition.QB,
              45,
              0)
          .withInterest(InterviewInterest.LUKEWARM)
          .build();

  private final List<HeadCoachCandidateView> all = List.of(aaron, blake, casey);

  @Test
  void apply_withDefaults_sortsByNameAscending() {
    var page = HeadCoachPoolFilter.apply(all, HeadCoachPoolQuery.defaults());

    assertThat(page.rows()).extracting(HeadCoachCandidateView::id).containsExactly(1L, 2L, 3L);
    assertThat(page.totalRows()).isEqualTo(3);
    assertThat(page.filteredRows()).isEqualTo(3);
  }

  @Test
  void apply_globalSearch_matchesNameOrArchetype() {
    var page = HeadCoachPoolFilter.apply(all, query().withQ("ceo").build());

    assertThat(page.rows()).extracting(HeadCoachCandidateView::id).containsExactly(2L);
  }

  @Test
  void apply_archetypeFilter_limitsToExactArchetype() {
    var page =
        HeadCoachPoolFilter.apply(
            all, query().withArchetype(CandidateArchetype.TACTICIAN.name()).build());

    assertThat(page.rows()).extracting(HeadCoachCandidateView::id).containsExactly(1L);
  }

  @Test
  void apply_specialtyFilter_limitsToExactSpecialty() {
    var page =
        HeadCoachPoolFilter.apply(all, query().withSpecialty(SpecialtyPosition.QB.name()).build());

    assertThat(page.rows()).extracting(HeadCoachCandidateView::id).containsExactly(1L, 3L);
  }

  @Test
  void apply_statusFilter_interviewedOnly() {
    var page =
        HeadCoachPoolFilter.apply(
            all, query().withStatus(HeadCoachPoolQuery.Status.INTERVIEWED.name()).build());

    assertThat(page.rows()).extracting(HeadCoachCandidateView::id).containsExactly(1L, 3L);
  }

  @Test
  void apply_statusFilter_notInterviewedOnly() {
    var page =
        HeadCoachPoolFilter.apply(
            all, query().withStatus(HeadCoachPoolQuery.Status.NOT_INTERVIEWED.name()).build());

    assertThat(page.rows()).extracting(HeadCoachCandidateView::id).containsExactly(2L);
  }

  @Test
  void apply_sortByAgeDescending() {
    var page =
        HeadCoachPoolFilter.apply(
            all,
            query()
                .withSort(HeadCoachPoolQuery.SortKey.AGE, HeadCoachPoolQuery.SortDir.DESC)
                .build());

    assertThat(page.rows()).extracting(HeadCoachCandidateView::age).containsExactly(60, 52, 45);
  }

  @Test
  void apply_sortByHcYears() {
    var page =
        HeadCoachPoolFilter.apply(
            all,
            query()
                .withSort(HeadCoachPoolQuery.SortKey.HC_YEARS, HeadCoachPoolQuery.SortDir.DESC)
                .build());

    assertThat(page.rows()).extracting(HeadCoachCandidateView::hcYears).containsExactly(12, 8, 0);
  }

  @Test
  void apply_sortByInterest_putsInterestedFirstAndUninterviewedLast() {
    var page =
        HeadCoachPoolFilter.apply(
            all,
            query()
                .withSort(HeadCoachPoolQuery.SortKey.INTEREST, HeadCoachPoolQuery.SortDir.ASC)
                .build());

    assertThat(page.rows()).extracting(HeadCoachCandidateView::id).containsExactly(1L, 3L, 2L);
  }

  @Test
  void apply_pagination_returnsRequestedSlice() {
    var page = HeadCoachPoolFilter.apply(all, query().withPage(2).withPageSize(2).build());

    assertThat(page.rows()).hasSize(1);
    assertThat(page.totalPages()).isEqualTo(2);
    assertThat(page.hasPrev()).isTrue();
    assertThat(page.hasNext()).isFalse();
  }

  @Test
  void apply_invalidArchetypeString_isIgnored() {
    var page = HeadCoachPoolFilter.apply(all, query().withArchetype("NONSENSE").build());

    assertThat(page.rows()).hasSize(3);
  }

  @Test
  void apply_filteredToEmpty_totalPagesIsOne() {
    var page = HeadCoachPoolFilter.apply(all, query().withQ("nomatch").build());

    assertThat(page.rows()).isEmpty();
    assertThat(page.totalPages()).isEqualTo(1);
  }

  private static QueryBuilder query() {
    return new QueryBuilder();
  }

  private static Candidate candidate(
      long id,
      String name,
      CandidateArchetype archetype,
      SpecialtyPosition specialty,
      int age,
      int hcYears) {
    return new Candidate(id, name, archetype, specialty, age, hcYears, Optional.empty());
  }

  private record Candidate(
      long id,
      String name,
      CandidateArchetype archetype,
      SpecialtyPosition specialty,
      int age,
      int hcYears,
      Optional<InterviewInterest> interest) {

    HeadCoachCandidateView build() {
      return new HeadCoachCandidateView(
          id,
          name,
          archetype,
          specialty,
          age,
          hcYears + 5,
          hcYears,
          3,
          5,
          new BigDecimal("8000000"),
          5,
          new BigDecimal("0.50"),
          interest,
          Optional.empty(),
          Optional.empty(),
          25_000_000_00L);
    }

    Candidate withInterest(InterviewInterest interest) {
      return new Candidate(id, name, archetype, specialty, age, hcYears, Optional.of(interest));
    }
  }

  private static final class QueryBuilder {
    private String q = "";
    private String archetype = "";
    private String specialty = "";
    private String status = "";
    private HeadCoachPoolQuery.SortKey sort = HeadCoachPoolQuery.SortKey.NAME;
    private HeadCoachPoolQuery.SortDir dir = HeadCoachPoolQuery.SortDir.ASC;
    private int page = 1;
    private int pageSize = HeadCoachPoolQuery.DEFAULT_PAGE_SIZE;

    QueryBuilder withQ(String v) {
      this.q = v;
      return this;
    }

    QueryBuilder withArchetype(String v) {
      this.archetype = v;
      return this;
    }

    QueryBuilder withSpecialty(String v) {
      this.specialty = v;
      return this;
    }

    QueryBuilder withStatus(String v) {
      this.status = v;
      return this;
    }

    QueryBuilder withSort(HeadCoachPoolQuery.SortKey s, HeadCoachPoolQuery.SortDir d) {
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

    HeadCoachPoolQuery build() {
      return new HeadCoachPoolQuery(q, archetype, specialty, status, sort, dir, page, pageSize);
    }
  }
}
