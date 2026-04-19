package app.zoneblitz.league.hiring;

import static app.zoneblitz.jooq.Tables.CANDIDATE_OFFERS;
import static app.zoneblitz.jooq.Tables.TEAMS;

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
  public CandidateOffer insertActive(long candidateId, long teamId, String terms, int day) {
    Objects.requireNonNull(terms, "terms");
    var record =
        dsl.insertInto(CANDIDATE_OFFERS)
            .set(CANDIDATE_OFFERS.CANDIDATE_ID, candidateId)
            .set(CANDIDATE_OFFERS.TEAM_ID, teamId)
            .set(CANDIDATE_OFFERS.TERMS, JSONB.valueOf(terms))
            .set(CANDIDATE_OFFERS.SUBMITTED_AT_DAY, day)
            .set(CANDIDATE_OFFERS.STATUS, OfferStatus.ACTIVE.name())
            .set(CANDIDATE_OFFERS.STANCE, OfferStance.PENDING.name())
            .set(CANDIDATE_OFFERS.REVISION_COUNT, 0)
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
  public Optional<CandidateOffer> findActiveForTeamAndCandidate(long teamId, long candidateId) {
    return dsl.selectFrom(CANDIDATE_OFFERS)
        .where(CANDIDATE_OFFERS.TEAM_ID.eq(teamId))
        .and(CANDIDATE_OFFERS.CANDIDATE_ID.eq(candidateId))
        .and(CANDIDATE_OFFERS.STATUS.eq(OfferStatus.ACTIVE.name()))
        .fetchOptional(this::map);
  }

  @Override
  public List<CandidateOffer> findAllForCandidate(long candidateId) {
    return dsl.selectFrom(CANDIDATE_OFFERS)
        .where(CANDIDATE_OFFERS.CANDIDATE_ID.eq(candidateId))
        .orderBy(CANDIDATE_OFFERS.SUBMITTED_AT_DAY.asc(), CANDIDATE_OFFERS.ID.asc())
        .fetch(this::map);
  }

  @Override
  public List<CandidateOffer> findActiveForCandidate(long candidateId) {
    return dsl.selectFrom(CANDIDATE_OFFERS)
        .where(CANDIDATE_OFFERS.CANDIDATE_ID.eq(candidateId))
        .and(CANDIDATE_OFFERS.STATUS.eq(OfferStatus.ACTIVE.name()))
        .orderBy(CANDIDATE_OFFERS.SUBMITTED_AT_DAY.asc(), CANDIDATE_OFFERS.ID.asc())
        .fetch(this::map);
  }

  @Override
  public List<CandidateOffer> findActiveForTeam(long teamId) {
    return dsl.selectFrom(CANDIDATE_OFFERS)
        .where(CANDIDATE_OFFERS.TEAM_ID.eq(teamId))
        .and(CANDIDATE_OFFERS.STATUS.eq(OfferStatus.ACTIVE.name()))
        .orderBy(CANDIDATE_OFFERS.SUBMITTED_AT_DAY.asc(), CANDIDATE_OFFERS.ID.asc())
        .fetch(this::map);
  }

  @Override
  public List<CandidateOffer> findActiveForLeague(long leagueId) {
    return dsl.select(CANDIDATE_OFFERS.fields())
        .from(CANDIDATE_OFFERS)
        .join(TEAMS)
        .on(TEAMS.ID.eq(CANDIDATE_OFFERS.TEAM_ID))
        .where(TEAMS.LEAGUE_ID.eq(leagueId))
        .and(CANDIDATE_OFFERS.STATUS.eq(OfferStatus.ACTIVE.name()))
        .orderBy(CANDIDATE_OFFERS.SUBMITTED_AT_DAY.asc(), CANDIDATE_OFFERS.ID.asc())
        .fetch(this::map);
  }

  @Override
  public CandidateOffer revise(long offerId, String terms, int day) {
    Objects.requireNonNull(terms, "terms");
    var record =
        dsl.update(CANDIDATE_OFFERS)
            .set(CANDIDATE_OFFERS.TERMS, JSONB.valueOf(terms))
            .set(CANDIDATE_OFFERS.SUBMITTED_AT_DAY, day)
            .set(CANDIDATE_OFFERS.STANCE, OfferStance.PENDING.name())
            .set(CANDIDATE_OFFERS.REVISION_COUNT, CANDIDATE_OFFERS.REVISION_COUNT.plus(1))
            .where(CANDIDATE_OFFERS.ID.eq(offerId))
            .and(CANDIDATE_OFFERS.STATUS.eq(OfferStatus.ACTIVE.name()))
            .returning(CANDIDATE_OFFERS.fields())
            .fetchOne();
    if (record == null) {
      throw new IllegalStateException("offer " + offerId + " is not ACTIVE; cannot revise");
    }
    return map(record);
  }

  @Override
  public void setStance(long offerId, OfferStance stance) {
    Objects.requireNonNull(stance, "stance");
    dsl.update(CANDIDATE_OFFERS)
        .set(CANDIDATE_OFFERS.STANCE, stance.name())
        .where(CANDIDATE_OFFERS.ID.eq(offerId))
        .and(CANDIDATE_OFFERS.STATUS.eq(OfferStatus.ACTIVE.name()))
        .execute();
  }

  @Override
  public boolean resolve(long offerId, OfferStatus status) {
    Objects.requireNonNull(status, "status");
    return dsl.update(CANDIDATE_OFFERS)
            .set(CANDIDATE_OFFERS.STATUS, status.name())
            .setNull(CANDIDATE_OFFERS.STANCE)
            .where(CANDIDATE_OFFERS.ID.eq(offerId))
            .and(CANDIDATE_OFFERS.STATUS.eq(OfferStatus.ACTIVE.name()))
            .execute()
        > 0;
  }

  private CandidateOffer map(org.jooq.Record r) {
    var stanceStr = r.get(CANDIDATE_OFFERS.STANCE);
    return new CandidateOffer(
        r.get(CANDIDATE_OFFERS.ID),
        r.get(CANDIDATE_OFFERS.CANDIDATE_ID),
        r.get(CANDIDATE_OFFERS.TEAM_ID),
        r.get(CANDIDATE_OFFERS.TERMS).data(),
        r.get(CANDIDATE_OFFERS.SUBMITTED_AT_DAY),
        OfferStatus.valueOf(r.get(CANDIDATE_OFFERS.STATUS)),
        stanceStr == null ? Optional.empty() : Optional.of(OfferStance.valueOf(stanceStr)),
        r.get(CANDIDATE_OFFERS.REVISION_COUNT));
  }
}
