package app.zoneblitz.league;

import static app.zoneblitz.jooq.Tables.TEAMS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.support.PostgresTestcontainer;
import java.util.List;
import java.util.Optional;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jooq.test.autoconfigure.JooqTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

@JooqTest
@Import(PostgresTestcontainer.class)
class JooqCandidateOfferRepositoryTests {

  @Autowired DSLContext dsl;

  private CandidateOfferRepository offers;
  private long candidateId;
  private long otherCandidateId;
  private long teamId;
  private long otherTeamId;

  @BeforeEach
  void setUp() {
    offers = new JooqCandidateOfferRepository(dsl);
    var leagues = new JooqLeagueRepository(dsl);
    var pools = new JooqCandidatePoolRepository(dsl);
    var candidates = new JooqCandidateRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var teamRepo = new JooqTeamRepository(dsl);
    var league =
        leagues.insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());
    var pool =
        pools.insert(league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    candidateId = candidates.insert(CandidateTestData.newHeadCoach(pool.id())).id();
    otherCandidateId = candidates.insert(CandidateTestData.newHeadCoach(pool.id())).id();
    var listed = franchises.listAll();
    teamRepo.insertAll(
        league.id(),
        List.of(
            new TeamDraft(listed.get(0).id(), Optional.of("sub-1")),
            new TeamDraft(listed.get(1).id(), Optional.empty())));
    var teamIds =
        dsl.select(TEAMS.ID)
            .from(TEAMS)
            .where(TEAMS.LEAGUE_ID.eq(league.id()))
            .orderBy(TEAMS.ID.asc())
            .fetch(TEAMS.ID);
    teamId = teamIds.get(0);
    otherTeamId = teamIds.get(1);
  }

  @Test
  void insertActive_returnsActiveOffer() {
    var offer = offers.insertActive(candidateId, teamId, "{\"salary\":8000000}", 1);

    assertThat(offer.id()).isPositive();
    assertThat(offer.status()).isEqualTo(OfferStatus.ACTIVE);
    assertThat(offer.submittedAtWeek()).isEqualTo(1);
    assertThat(offer.terms()).contains("salary");
  }

  @Test
  void insertActive_whenTeamAlreadyHasActiveOfferOnCandidate_throws() {
    offers.insertActive(candidateId, teamId, "{}", 1);

    assertThatThrownBy(() -> offers.insertActive(candidateId, teamId, "{}", 2))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void resolve_marksOfferTerminal() {
    var offer = offers.insertActive(candidateId, teamId, "{}", 1);

    assertThat(offers.resolve(offer.id(), OfferStatus.ACCEPTED)).isTrue();
    assertThat(offers.findById(offer.id()).orElseThrow().status()).isEqualTo(OfferStatus.ACCEPTED);
  }

  @Test
  void resolve_whenNotActive_returnsFalse() {
    var offer = offers.insertActive(candidateId, teamId, "{}", 1);
    offers.resolve(offer.id(), OfferStatus.REJECTED);

    assertThat(offers.resolve(offer.id(), OfferStatus.ACCEPTED)).isFalse();
  }

  @Test
  void findActiveForCandidate_onlyReturnsActive() {
    var active = offers.insertActive(candidateId, teamId, "{}", 1);
    var resolved = offers.insertActive(candidateId, otherTeamId, "{}", 1);
    offers.resolve(resolved.id(), OfferStatus.REJECTED);

    assertThat(offers.findActiveForCandidate(candidateId))
        .extracting(CandidateOffer::id)
        .containsExactly(active.id());
  }

  @Test
  void findActiveForTeam_returnsOnlyThatTeamsActiveOffers() {
    offers.insertActive(candidateId, teamId, "{}", 1);
    offers.insertActive(otherCandidateId, teamId, "{}", 1);
    offers.insertActive(candidateId, otherTeamId, "{}", 1);

    assertThat(offers.findActiveForTeam(teamId)).hasSize(2);
  }

  @Test
  void findAllForCandidate_returnsAllStatuses() {
    var a = offers.insertActive(candidateId, teamId, "{}", 1);
    var b = offers.insertActive(candidateId, otherTeamId, "{}", 2);
    offers.resolve(b.id(), OfferStatus.REJECTED);

    assertThat(offers.findAllForCandidate(candidateId))
        .extracting(CandidateOffer::id)
        .containsExactly(a.id(), b.id());
  }

  @Test
  void insertActive_afterRejection_allowedAgain() {
    var first = offers.insertActive(candidateId, teamId, "{}", 1);
    offers.resolve(first.id(), OfferStatus.REJECTED);

    var rebid = offers.insertActive(candidateId, teamId, "{}", 2);
    assertThat(rebid.status()).isEqualTo(OfferStatus.ACTIVE);
  }
}
