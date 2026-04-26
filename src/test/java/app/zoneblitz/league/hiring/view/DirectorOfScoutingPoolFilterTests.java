package app.zoneblitz.league.hiring.view;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.hiring.CandidateArchetype;
import app.zoneblitz.league.hiring.InterviewInterest;
import app.zoneblitz.league.staff.SpecialtyPosition;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class DirectorOfScoutingPoolFilterTests {

  private final DirectorOfScoutingCandidateView aaron =
      candidate(1L, "Aaron Eval", CandidateArchetype.COLLEGE_EVALUATOR, SpecialtyPosition.WR, 48, 6)
          .withInterest(InterviewInterest.INTERESTED)
          .build();
  private final DirectorOfScoutingCandidateView blake =
      candidate(2L, "Blake General", CandidateArchetype.GENERALIST, SpecialtyPosition.DL, 55, 10)
          .build();
  private final DirectorOfScoutingCandidateView casey =
      candidate(3L, "Casey Pro", CandidateArchetype.PRO_EVALUATOR, SpecialtyPosition.WR, 41, 0)
          .withInterest(InterviewInterest.LUKEWARM)
          .build();

  private final List<DirectorOfScoutingCandidateView> all = List.of(aaron, blake, casey);

  @Test
  void apply_withDefaults_sortsByNameAscending() {
    var page = DirectorOfScoutingPoolFilter.apply(all, DirectorOfScoutingPoolQuery.defaults());

    assertThat(page.rows())
        .extracting(DirectorOfScoutingCandidateView::id)
        .containsExactly(1L, 2L, 3L);
  }

  @Test
  void apply_globalSearch_matchesArchetypeDisplayName() {
    var page = DirectorOfScoutingPoolFilter.apply(all, query().withQ("pro evaluator").build());

    assertThat(page.rows()).extracting(DirectorOfScoutingCandidateView::id).containsExactly(3L);
  }

  @Test
  void apply_archetypeFilter_limitsToExactArchetype() {
    var page =
        DirectorOfScoutingPoolFilter.apply(
            all, query().withArchetype(CandidateArchetype.COLLEGE_EVALUATOR.name()).build());

    assertThat(page.rows()).extracting(DirectorOfScoutingCandidateView::id).containsExactly(1L);
  }

  @Test
  void apply_specialtyFilter_limitsToExactSpecialty() {
    var page =
        DirectorOfScoutingPoolFilter.apply(
            all, query().withSpecialty(SpecialtyPosition.WR.name()).build());

    assertThat(page.rows()).extracting(DirectorOfScoutingCandidateView::id).containsExactly(1L, 3L);
  }

  @Test
  void apply_statusFilter_notInterviewedOnly() {
    var page =
        DirectorOfScoutingPoolFilter.apply(
            all,
            query().withStatus(DirectorOfScoutingPoolQuery.Status.NOT_INTERVIEWED.name()).build());

    assertThat(page.rows()).extracting(DirectorOfScoutingCandidateView::id).containsExactly(2L);
  }

  @Test
  void apply_sortByDosYearsDescending() {
    var page =
        DirectorOfScoutingPoolFilter.apply(
            all,
            query()
                .withSort(
                    DirectorOfScoutingPoolQuery.SortKey.DOS_YEARS,
                    DirectorOfScoutingPoolQuery.SortDir.DESC)
                .build());

    assertThat(page.rows())
        .extracting(DirectorOfScoutingCandidateView::dosYears)
        .containsExactly(10, 6, 0);
  }

  @Test
  void apply_sortByInterest_putsInterestedFirstAndUninterviewedLast() {
    var page =
        DirectorOfScoutingPoolFilter.apply(
            all,
            query()
                .withSort(
                    DirectorOfScoutingPoolQuery.SortKey.INTEREST,
                    DirectorOfScoutingPoolQuery.SortDir.ASC)
                .build());

    assertThat(page.rows())
        .extracting(DirectorOfScoutingCandidateView::id)
        .containsExactly(1L, 3L, 2L);
  }

  @Test
  void apply_pagination_returnsRequestedSlice() {
    var page = DirectorOfScoutingPoolFilter.apply(all, query().withPage(2).withPageSize(2).build());

    assertThat(page.rows()).hasSize(1);
    assertThat(page.totalPages()).isEqualTo(2);
    assertThat(page.hasPrev()).isTrue();
    assertThat(page.hasNext()).isFalse();
  }

  @Test
  void apply_invalidArchetypeString_isIgnored() {
    var page = DirectorOfScoutingPoolFilter.apply(all, query().withArchetype("NONSENSE").build());

    assertThat(page.rows()).hasSize(3);
  }

  @Test
  void apply_filteredToEmpty_totalPagesIsOne() {
    var page = DirectorOfScoutingPoolFilter.apply(all, query().withQ("nomatch").build());

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
      int dosYears) {
    return new Candidate(id, name, archetype, specialty, age, dosYears, Optional.empty());
  }

  private record Candidate(
      long id,
      String name,
      CandidateArchetype archetype,
      SpecialtyPosition specialty,
      int age,
      int dosYears,
      Optional<InterviewInterest> interest) {

    DirectorOfScoutingCandidateView build() {
      return new DirectorOfScoutingCandidateView(
          id,
          name,
          archetype,
          specialty,
          age,
          dosYears + 5,
          dosYears,
          3,
          5,
          new BigDecimal("4000000"),
          4,
          new BigDecimal("0.40"),
          interest,
          Optional.empty(),
          Optional.empty());
    }

    Candidate withInterest(InterviewInterest interest) {
      return new Candidate(id, name, archetype, specialty, age, dosYears, Optional.of(interest));
    }
  }

  private static final class QueryBuilder {
    private String q = "";
    private String archetype = "";
    private String specialty = "";
    private String status = "";
    private DirectorOfScoutingPoolQuery.SortKey sort = DirectorOfScoutingPoolQuery.SortKey.NAME;
    private DirectorOfScoutingPoolQuery.SortDir dir = DirectorOfScoutingPoolQuery.SortDir.ASC;
    private int page = 1;
    private int pageSize = DirectorOfScoutingPoolQuery.DEFAULT_PAGE_SIZE;

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

    QueryBuilder withSort(
        DirectorOfScoutingPoolQuery.SortKey s, DirectorOfScoutingPoolQuery.SortDir d) {
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

    DirectorOfScoutingPoolQuery build() {
      return new DirectorOfScoutingPoolQuery(
          q, archetype, specialty, status, sort, dir, page, pageSize);
    }
  }
}
