package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.support.PostgresTestcontainer;
import java.util.List;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

@JooqTest
@Import(PostgresTestcontainer.class)
class JooqFranchiseHiringStateRepositoryTests {

  @Autowired DSLContext dsl;

  private FranchiseHiringStateRepository states;
  private long leagueId;
  private long franchiseId;
  private long otherFranchiseId;

  @BeforeEach
  void setUp() {
    states = new JooqFranchiseHiringStateRepository(dsl);
    var leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    leagueId =
        leagues
            .insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults())
            .id();
    var listed = franchises.listAll();
    franchiseId = listed.get(0).id();
    otherFranchiseId = listed.get(1).id();
  }

  @Test
  void upsert_insertsOnFirstCall() {
    var inserted =
        states.upsert(
            new FranchiseHiringState(
                0,
                leagueId,
                franchiseId,
                LeaguePhase.HIRING_HEAD_COACH,
                HiringStep.SEARCHING,
                List.of(1L, 2L, 3L),
                List.of(1L)));

    assertThat(inserted.id()).isPositive();
    assertThat(inserted.shortlist()).containsExactly(1L, 2L, 3L);
    assertThat(inserted.interviewingCandidateIds()).containsExactly(1L);
  }

  @Test
  void upsert_replacesOnSameLeaguePhaseAndFranchise() {
    states.upsert(
        new FranchiseHiringState(
            0,
            leagueId,
            franchiseId,
            LeaguePhase.HIRING_HEAD_COACH,
            HiringStep.SEARCHING,
            List.of(1L, 2L),
            List.of()));

    var updated =
        states.upsert(
            new FranchiseHiringState(
                0,
                leagueId,
                franchiseId,
                LeaguePhase.HIRING_HEAD_COACH,
                HiringStep.HIRED,
                List.of(7L),
                List.of(7L)));

    assertThat(updated.step()).isEqualTo(HiringStep.HIRED);
    assertThat(updated.shortlist()).containsExactly(7L);
    assertThat(states.findAllForLeaguePhase(leagueId, LeaguePhase.HIRING_HEAD_COACH)).hasSize(1);
  }

  @Test
  void find_whenMissing_returnsEmpty() {
    assertThat(states.find(leagueId, franchiseId, LeaguePhase.HIRING_HEAD_COACH)).isEmpty();
  }

  @Test
  void findAllForLeaguePhase_returnsAllFranchisesForPhase() {
    states.upsert(
        new FranchiseHiringState(
            0,
            leagueId,
            franchiseId,
            LeaguePhase.HIRING_HEAD_COACH,
            HiringStep.SEARCHING,
            List.of(),
            List.of()));
    states.upsert(
        new FranchiseHiringState(
            0,
            leagueId,
            otherFranchiseId,
            LeaguePhase.HIRING_HEAD_COACH,
            HiringStep.HIRED,
            List.of(),
            List.of()));

    assertThat(states.findAllForLeaguePhase(leagueId, LeaguePhase.HIRING_HEAD_COACH)).hasSize(2);
  }

  @Test
  void roundTrip_preservesEmptyArrays() {
    var inserted =
        states.upsert(
            new FranchiseHiringState(
                0,
                leagueId,
                franchiseId,
                LeaguePhase.HIRING_HEAD_COACH,
                HiringStep.SEARCHING,
                List.of(),
                List.of()));

    assertThat(inserted.shortlist()).isEmpty();
    assertThat(inserted.interviewingCandidateIds()).isEmpty();
  }
}
