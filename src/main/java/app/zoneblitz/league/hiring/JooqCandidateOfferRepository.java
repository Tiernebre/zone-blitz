package app.zoneblitz.league.hiring;

import static app.zoneblitz.jooq.Tables.CANDIDATE_OFFERS;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Repository;

@Repository
public class JooqCandidateOfferRepository implements CandidateOfferRepository {

  private final DSLContext dsl;

  public JooqCandidateOfferRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public CandidateOffer insertActive(long candidateId, long teamId, String terms, int week) {
    Objects.requireNonNull(terms, "terms");
    var record =
        dsl.insertInto(CANDIDATE_OFFERS)
            .set(CANDIDATE_OFFERS.CANDIDATE_ID, candidateId)
            .set(CANDIDATE_OFFERS.TEAM_ID, teamId)
            .set(CANDIDATE_OFFERS.TERMS, JSONB.valueOf(terms))
            .set(CANDIDATE_OFFERS.SUBMITTED_AT_WEEK, week)
            .set(CANDIDATE_OFFERS.STATUS, OfferStatus.ACTIVE.name())
            .returning(CANDIDATE_OFFERS.fields())
            .fetchOne();
    return map(record);
  }

  @Override
  public Optional<CandidateOffer> findById(long id) {
    return dsl.selectFrom(CANDIDATE_OFFERS)
        .where(CANDIDATE_OFFERS.ID.eq(id))
        .fetchOptional(this::map);
  }

  @Override
  public List<CandidateOffer> findAllForCandidate(long candidateId) {
    return dsl.selectFrom(CANDIDATE_OFFERS)
        .where(CANDIDATE_OFFERS.CANDIDATE_ID.eq(candidateId))
        .orderBy(CANDIDATE_OFFERS.SUBMITTED_AT_WEEK.asc(), CANDIDATE_OFFERS.ID.asc())
        .fetch(this::map);
  }

  @Override
  public List<CandidateOffer> findActiveForCandidate(long candidateId) {
    return dsl.selectFrom(CANDIDATE_OFFERS)
        .where(CANDIDATE_OFFERS.CANDIDATE_ID.eq(candidateId))
        .and(CANDIDATE_OFFERS.STATUS.eq(OfferStatus.ACTIVE.name()))
        .orderBy(CANDIDATE_OFFERS.SUBMITTED_AT_WEEK.asc(), CANDIDATE_OFFERS.ID.asc())
        .fetch(this::map);
  }

  @Override
  public List<CandidateOffer> findActiveForTeam(long teamId) {
    return dsl.selectFrom(CANDIDATE_OFFERS)
        .where(CANDIDATE_OFFERS.TEAM_ID.eq(teamId))
        .and(CANDIDATE_OFFERS.STATUS.eq(OfferStatus.ACTIVE.name()))
        .orderBy(CANDIDATE_OFFERS.SUBMITTED_AT_WEEK.asc(), CANDIDATE_OFFERS.ID.asc())
        .fetch(this::map);
  }

  @Override
  public boolean resolve(long offerId, OfferStatus status) {
    Objects.requireNonNull(status, "status");
    return dsl.update(CANDIDATE_OFFERS)
            .set(CANDIDATE_OFFERS.STATUS, status.name())
            .where(CANDIDATE_OFFERS.ID.eq(offerId))
            .and(CANDIDATE_OFFERS.STATUS.eq(OfferStatus.ACTIVE.name()))
            .execute()
        > 0;
  }

  private CandidateOffer map(org.jooq.Record r) {
    return new CandidateOffer(
        r.get(CANDIDATE_OFFERS.ID),
        r.get(CANDIDATE_OFFERS.CANDIDATE_ID),
        r.get(CANDIDATE_OFFERS.TEAM_ID),
        r.get(CANDIDATE_OFFERS.TERMS).data(),
        r.get(CANDIDATE_OFFERS.SUBMITTED_AT_WEEK),
        OfferStatus.valueOf(r.get(CANDIDATE_OFFERS.STATUS)));
  }
}
