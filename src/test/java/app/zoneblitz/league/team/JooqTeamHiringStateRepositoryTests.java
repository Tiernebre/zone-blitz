package app.zoneblitz.league.team;

import static app.zoneblitz.jooq.Tables.TEAMS;
import static org.assertj.core.api.Assertions.assertThat;

import app.zoneblitz.league.JooqLeagueRepository;
import app.zoneblitz.league.LeagueSettings;
import app.zoneblitz.league.franchise.JooqFranchiseRepository;
import app.zoneblitz.league.phase.HiringStep;
import app.zoneblitz.league.phase.LeaguePhase;
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
class JooqTeamHiringStateRepositoryTests {

  @Autowired DSLContext dsl;

  private TeamHiringStateRepository states;
  private long leagueId;
  private long teamId;
  private long otherTeamId;

  @BeforeEach
  void setUp() {
    states = new JooqTeamHiringStateRepository(dsl);
    var leagues = new JooqLeagueRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    leagueId =
        leagues
            .insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults())
            .id();
    var listed = franchises.listAll();
    teamRepo.insertAll(
        leagueId,
        List.of(
            new TeamDraft(listed.get(0).id(), Optional.of("sub-1")),
            new TeamDraft(listed.get(1).id(), Optional.empty())));
    var teamIds =
        dsl.select(TEAMS.ID)
            .from(TEAMS)
            .where(TEAMS.LEAGUE_ID.eq(leagueId))
            .orderBy(TEAMS.ID.asc())
            .fetch(TEAMS.ID);
    teamId = teamIds.get(0);
    otherTeamId = teamIds.get(1);
  }

  @Test
  void upsert_insertsOnFirstCall() {
    var inserted =
        states.upsert(
            new TeamHiringState(
                0, teamId, LeaguePhase.HIRING_HEAD_COACH, HiringStep.SEARCHING, List.of(1L)));

    assertThat(inserted.id()).isPositive();
    assertThat(inserted.interviewingCandidateIds()).containsExactly(1L);
  }

  @Test
  void upsert_replacesOnSameTeamAndPhase() {
    states.upsert(
        new TeamHiringState(
            0, teamId, LeaguePhase.HIRING_HEAD_COACH, HiringStep.SEARCHING, List.of()));

    var updated =
        states.upsert(
            new TeamHiringState(
                0, teamId, LeaguePhase.HIRING_HEAD_COACH, HiringStep.HIRED, List.of(7L)));

    assertThat(updated.step()).isEqualTo(HiringStep.HIRED);
    assertThat(updated.interviewingCandidateIds()).containsExactly(7L);
    assertThat(states.findAllForLeaguePhase(leagueId, LeaguePhase.HIRING_HEAD_COACH)).hasSize(1);
  }

  @Test
  void find_whenMissing_returnsEmpty() {
    assertThat(states.find(teamId, LeaguePhase.HIRING_HEAD_COACH)).isEmpty();
  }

  @Test
  void findAllForLeaguePhase_returnsAllTeamsForPhase() {
    states.upsert(
        new TeamHiringState(
            0, teamId, LeaguePhase.HIRING_HEAD_COACH, HiringStep.SEARCHING, List.of()));
    states.upsert(
        new TeamHiringState(
            0, otherTeamId, LeaguePhase.HIRING_HEAD_COACH, HiringStep.HIRED, List.of()));

    assertThat(states.findAllForLeaguePhase(leagueId, LeaguePhase.HIRING_HEAD_COACH)).hasSize(2);
  }

  @Test
  void roundTrip_preservesEmptyArrays() {
    var inserted =
        states.upsert(
            new TeamHiringState(
                0, teamId, LeaguePhase.HIRING_HEAD_COACH, HiringStep.SEARCHING, List.of()));

    assertThat(inserted.interviewingCandidateIds()).isEmpty();
  }
}
