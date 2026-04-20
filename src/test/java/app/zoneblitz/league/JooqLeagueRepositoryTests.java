package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.franchise.FranchiseRepository;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.team.JooqTeamRepository;
import app.zoneblitz.league.team.TeamDraft;
import app.zoneblitz.league.team.TeamRepository;
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
            new TeamDraft(pickOther(minutemen.id()), Optional.empty())),
        0L);

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
    teams.insertAll(mine.id(), List.of(new TeamDraft(franchise.id(), Optional.of("me"))), 0L);
    var theirs =
        leagues.insert("them", "Theirs", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());
    teams.insertAll(theirs.id(), List.of(new TeamDraft(franchise.id(), Optional.of("them"))), 0L);

    assertThat(leagues.findSummariesFor("me"))
        .singleElement()
        .satisfies(s -> assertThat(s.leagueName()).isEqualTo("Mine"));
  }

  @Test
  void findSummaryByIdAndOwner_whenOwned_returnsSummary() {
    var franchise = franchises.listAll().getFirst();
    var league =
        leagues.insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());
    teams.insertAll(league.id(), List.of(new TeamDraft(franchise.id(), Optional.of("sub-1"))), 0L);

    var summary = leagues.findSummaryByIdAndOwner(league.id(), "sub-1");

    assertThat(summary).hasValueSatisfying(s -> assertThat(s.leagueName()).isEqualTo("Dynasty"));
  }

  @Test
  void findSummaryByIdAndOwner_whenNotOwned_returnsEmpty() {
    var franchise = franchises.listAll().getFirst();
    var league =
        leagues.insert("owner", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());
    teams.insertAll(league.id(), List.of(new TeamDraft(franchise.id(), Optional.of("owner"))), 0L);

    assertThat(leagues.findSummaryByIdAndOwner(league.id(), "someone-else")).isEmpty();
  }

  @Test
  void findSummaryByIdAndOwner_whenMissing_returnsEmpty() {
    assertThat(leagues.findSummaryByIdAndOwner(999_999L, "sub-1")).isEmpty();
  }

  @Test
  void deleteByIdAndOwner_whenOwned_deletesLeagueAndCascadesTeams() {
    var franchise = franchises.listAll().getFirst();
    var league =
        leagues.insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());
    teams.insertAll(league.id(), List.of(new TeamDraft(franchise.id(), Optional.of("sub-1"))), 0L);

    assertThat(leagues.deleteByIdAndOwner(league.id(), "sub-1")).isTrue();
    assertThat(leagues.findSummaryByIdAndOwner(league.id(), "sub-1")).isEmpty();
    assertThat(
            dsl.fetchCount(
                app.zoneblitz.jooq.Tables.TEAMS,
                app.zoneblitz.jooq.Tables.TEAMS.LEAGUE_ID.eq(league.id())))
        .isZero();
  }

  @Test
  void deleteByIdAndOwner_whenNotOwned_returnsFalseAndLeavesLeagueIntact() {
    var franchise = franchises.listAll().getFirst();
    var league =
        leagues.insert("owner", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());
    teams.insertAll(league.id(), List.of(new TeamDraft(franchise.id(), Optional.of("owner"))), 0L);

    assertThat(leagues.deleteByIdAndOwner(league.id(), "someone-else")).isFalse();
    assertThat(leagues.findSummaryByIdAndOwner(league.id(), "owner")).isPresent();
  }

  @Test
  void deleteByIdAndOwner_whenMissing_returnsFalse() {
    assertThat(leagues.deleteByIdAndOwner(999_999L, "sub-1")).isFalse();
  }

  @Test
  void insert_setsPhaseWeekToOneByDefault() {
    var league =
        leagues.insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());

    assertThat(league.phaseDay()).isEqualTo(1);
  }

  @Test
  void findById_whenPresent_returnsLeagueWithPhaseWeek() {
    var inserted =
        leagues.insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());

    assertThat(leagues.findById(inserted.id()))
        .hasValueSatisfying(
            l -> {
              assertThat(l.id()).isEqualTo(inserted.id());
              assertThat(l.phase()).isEqualTo(LeaguePhase.INITIAL_SETUP);
              assertThat(l.phaseDay()).isEqualTo(1);
            });
  }

  @Test
  void findById_whenMissing_returnsEmpty() {
    assertThat(leagues.findById(999_999L)).isEmpty();
  }

  @Test
  void incrementPhaseWeek_whenPresent_bumpsCounterAndReturnsNewValue() {
    var league =
        leagues.insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());

    assertThat(leagues.incrementPhaseDay(league.id())).hasValue(2);
    assertThat(leagues.incrementPhaseDay(league.id())).hasValue(3);
    assertThat(leagues.findById(league.id()).orElseThrow().phaseDay()).isEqualTo(3);
  }

  @Test
  void incrementPhaseWeek_whenMissing_returnsEmpty() {
    assertThat(leagues.incrementPhaseDay(999_999L)).isEmpty();
  }

  @Test
  void updatePhaseAndResetWeek_changesPhaseAndResetsWeekToOne() {
    var league =
        leagues.insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());
    leagues.incrementPhaseDay(league.id());
    leagues.incrementPhaseDay(league.id());

    assertThat(leagues.updatePhaseAndResetDay(league.id(), LeaguePhase.HIRING_HEAD_COACH)).isTrue();

    var after = leagues.findById(league.id()).orElseThrow();
    assertThat(after.phase()).isEqualTo(LeaguePhase.HIRING_HEAD_COACH);
    assertThat(after.phaseDay()).isEqualTo(1);
  }

  @Test
  void updatePhaseAndResetWeek_whenMissing_returnsFalse() {
    assertThat(leagues.updatePhaseAndResetDay(999_999L, LeaguePhase.HIRING_HEAD_COACH)).isFalse();
  }

  private long pickOther(long excludeId) {
    return franchises.listAll().stream()
        .filter(f -> f.id() != excludeId)
        .findFirst()
        .orElseThrow()
        .id();
  }
}
