package app.zoneblitz.league;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.zoneblitz.support.PostgresTestcontainer;
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
  private long franchiseId;
  private long otherFranchiseId;

  @BeforeEach
  void setUp() {
    offers = new JooqCandidateOfferRepository(dsl);
    var leagues = new JooqLeagueRepository(dsl);
    var pools = new JooqCandidatePoolRepository(dsl);
    var candidates = new JooqCandidateRepository(dsl);
    var franchises = new JooqFranchiseRepository(dsl);
    var league =
        leagues.insert("sub-1", "Dynasty", LeaguePhase.INITIAL_SETUP, LeagueSettings.defaults());
    var pool =
        pools.insert(league.id(), LeaguePhase.HIRING_HEAD_COACH, CandidatePoolType.HEAD_COACH);
    candidateId = candidates.insert(CandidateTestData.newHeadCoach(pool.id())).id();
    otherCandidateId = candidates.insert(CandidateTestData.newHeadCoach(pool.id())).id();
    var listed = franchises.listAll();
    franchiseId = listed.get(0).id();
    otherFranchiseId = listed.get(1).id();
  }

  @Test
  void insertActive_returnsActiveOffer() {
    var offer = offers.insertActive(candidateId, franchiseId, "{\"salary\":8000000}", 1);

    assertThat(offer.id()).isPositive();
    assertThat(offer.status()).isEqualTo(OfferStatus.ACTIVE);
    assertThat(offer.submittedAtWeek()).isEqualTo(1);
    assertThat(offer.terms()).contains("salary");
  }

  @Test
  void insertActive_whenFranchiseAlreadyHasActiveOfferOnCandidate_throws() {
    offers.insertActive(candidateId, franchiseId, "{}", 1);

    assertThatThrownBy(() -> offers.insertActive(candidateId, franchiseId, "{}", 2))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void resolve_marksOfferTerminal() {
    var offer = offers.insertActive(candidateId, franchiseId, "{}", 1);

    assertThat(offers.resolve(offer.id(), OfferStatus.ACCEPTED)).isTrue();
    assertThat(offers.findById(offer.id()).orElseThrow().status()).isEqualTo(OfferStatus.ACCEPTED);
  }

  @Test
  void resolve_whenNotActive_returnsFalse() {
    var offer = offers.insertActive(candidateId, franchiseId, "{}", 1);
    offers.resolve(offer.id(), OfferStatus.REJECTED);

    assertThat(offers.resolve(offer.id(), OfferStatus.ACCEPTED)).isFalse();
  }

  @Test
  void findActiveForCandidate_onlyReturnsActive() {
    var active = offers.insertActive(candidateId, franchiseId, "{}", 1);
    var resolved = offers.insertActive(candidateId, otherFranchiseId, "{}", 1);
    offers.resolve(resolved.id(), OfferStatus.REJECTED);

    assertThat(offers.findActiveForCandidate(candidateId))
        .extracting(CandidateOffer::id)
        .containsExactly(active.id());
  }

  @Test
  void findActiveForFranchise_returnsOnlyThatFranchisesActiveOffers() {
    offers.insertActive(candidateId, franchiseId, "{}", 1);
    offers.insertActive(otherCandidateId, franchiseId, "{}", 1);
    offers.insertActive(candidateId, otherFranchiseId, "{}", 1);

    assertThat(offers.findActiveForFranchise(franchiseId)).hasSize(2);
  }

  @Test
  void findAllForCandidate_returnsAllStatuses() {
    var a = offers.insertActive(candidateId, franchiseId, "{}", 1);
    var b = offers.insertActive(candidateId, otherFranchiseId, "{}", 2);
    offers.resolve(b.id(), OfferStatus.REJECTED);

    assertThat(offers.findAllForCandidate(candidateId))
        .extracting(CandidateOffer::id)
        .containsExactly(a.id(), b.id());
  }

  @Test
  void insertActive_afterRejection_allowedAgain() {
    var first = offers.insertActive(candidateId, franchiseId, "{}", 1);
    offers.resolve(first.id(), OfferStatus.REJECTED);

    var rebid = offers.insertActive(candidateId, franchiseId, "{}", 2);
    assertThat(rebid.status()).isEqualTo(OfferStatus.ACTIVE);
  }
}
