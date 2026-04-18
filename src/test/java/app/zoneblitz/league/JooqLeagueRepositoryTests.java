package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.support.PostgresTestcontainer;
import java.util.List;
import java.util.Optional;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;

@JooqTest
@Import(PostgresTestcontainer.class)
class JooqLeagueRepositoryTests {

  @Autowired DSLContext dsl;

  private LeagueRepository leagues;
  private FranchiseRepository franchises;
  private TeamRepository teams;

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    franchises = new JooqFranchiseRepository(dsl);
    teams = new JooqTeamRepository(dsl);
  }

  @Test
  void listAll_returnsEightSeededFranchises() {
    assertThat(franchises.listAll()).hasSize(8);
  }

  @Test
  void insert_thenFindSummariesFor_returnsLeagueWithUserFranchise() {
    var minutemen =
        franchises.listAll().stream()
            .filter(f -> f.name().equals("Minutemen"))
            .findFirst()
            .orElseThrow();
    var league =
        leagues.insert("sub-1", "My Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());
    teams.insertAll(
        league.id(),
        List.of(
            new TeamDraft(minutemen.id(), Optional.of("sub-1")),
            new TeamDraft(pickOther(minutemen.id()), Optional.empty())));

    var summaries = leagues.findSummariesFor("sub-1");

    assertThat(summaries).hasSize(1);
    var summary = summaries.getFirst();
    assertThat(summary.leagueName()).isEqualTo("My Dynasty");
    assertThat(summary.phase()).isEqualTo(LeaguePhase.INITIAL_SETUP);
    assertThat(summary.userFranchise().name()).isEqualTo("Minutemen");
    assertThat(summary.userFranchise().city().name()).isEqualTo("Boston");
    assertThat(summary.userFranchise().city().state().code()).isEqualTo("MA");
  }

  @Test
  void existsByOwnerAndName_isCaseInsensitive() {
    leagues.insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());

    assertThat(leagues.existsByOwnerAndName("sub-1", "dynasty")).isTrue();
    assertThat(leagues.existsByOwnerAndName("sub-1", "DYNASTY")).isTrue();
    assertThat(leagues.existsByOwnerAndName("other", "Dynasty")).isFalse();
  }

  @Test
  void findSummariesFor_onlyReturnsCallersLeagues() {
    var franchise = franchises.listAll().getFirst();
    var mine = leagues.insert("me", "Mine", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());
    teams.insertAll(mine.id(), List.of(new TeamDraft(franchise.id(), Optional.of("me"))));
    var theirs =
        leagues.insert("them", "Theirs", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());
    teams.insertAll(theirs.id(), List.of(new TeamDraft(franchise.id(), Optional.of("them"))));

    assertThat(leagues.findSummariesFor("me"))
        .singleElement()
        .satisfies(s -> assertThat(s.leagueName()).isEqualTo("Mine"));
  }

  private long pickOther(long excludeId) {
    return franchises.listAll().stream()
        .filter(f -> f.id() != excludeId)
        .findFirst()
        .orElseThrow()
        .id();
  }
}
