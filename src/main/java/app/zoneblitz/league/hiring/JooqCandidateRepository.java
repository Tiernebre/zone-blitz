package app.zoneblitz.league.hiring;

import static app.zoneblitz.jooq.Tables.CANDIDATES;

import app.zoneblitz.league.staff.SpecialtyPosition;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Repository;

@Repository
public class JooqCandidateRepository implements CandidateRepository {

  private final DSLContext dsl;

  public JooqCandidateRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public Candidate insert(NewCandidate newCandidate) {
    Objects.requireNonNull(newCandidate, "newCandidate");
    var record =
        dsl.insertInto(CANDIDATES)
            .set(CANDIDATES.POOL_ID, newCandidate.poolId())
            .set(CANDIDATES.KIND, newCandidate.kind().name())
            .set(CANDIDATES.SPECIALTY_POSITION, newCandidate.specialtyPosition().name())
            .set(CANDIDATES.ARCHETYPE, newCandidate.archetype().name())
            .set(CANDIDATES.AGE, newCandidate.age())
            .set(CANDIDATES.TOTAL_EXPERIENCE_YEARS, newCandidate.totalExperienceYears())
            .set(CANDIDATES.EXPERIENCE_BY_ROLE, JSONB.valueOf(newCandidate.experienceByRole()))
            .set(CANDIDATES.HIDDEN_ATTRS, JSONB.valueOf(newCandidate.hiddenAttrs()))
            .set(CANDIDATES.SCOUTED_ATTRS, JSONB.valueOf(newCandidate.scoutedAttrs()))
            .set(CANDIDATES.SCOUT_BRANCH, newCandidate.scoutBranch().map(Enum::name).orElse(null))
            .returning(CANDIDATES.fields())
            .fetchOne();
    return map(record);
  }

  @Override
  public Optional<Candidate> findById(long id) {
    return dsl.selectFrom(CANDIDATES).where(CANDIDATES.ID.eq(id)).fetchOptional(this::map);
  }

  @Override
  public List<Candidate> findAllByPoolId(long poolId) {
    return dsl.selectFrom(CANDIDATES)
        .where(CANDIDATES.POOL_ID.eq(poolId))
        .orderBy(CANDIDATES.ID.asc())
        .fetch(this::map);
  }

  @Override
  public boolean markHired(long candidateId, long teamId) {
    return dsl.update(CANDIDATES)
            .set(CANDIDATES.HIRED_BY_TEAM_ID, teamId)
            .where(CANDIDATES.ID.eq(candidateId))
            .execute()
        > 0;
  }

  private Candidate map(org.jooq.Record r) {
    return new Candidate(
        r.get(CANDIDATES.ID),
        r.get(CANDIDATES.POOL_ID),
        CandidateKind.valueOf(r.get(CANDIDATES.KIND)),
        SpecialtyPosition.valueOf(r.get(CANDIDATES.SPECIALTY_POSITION)),
        CandidateArchetype.valueOf(r.get(CANDIDATES.ARCHETYPE)),
        r.get(CANDIDATES.AGE),
        r.get(CANDIDATES.TOTAL_EXPERIENCE_YEARS),
        r.get(CANDIDATES.EXPERIENCE_BY_ROLE).data(),
        r.get(CANDIDATES.HIDDEN_ATTRS).data(),
        r.get(CANDIDATES.SCOUTED_ATTRS).data(),
        Optional.ofNullable(r.get(CANDIDATES.HIRED_BY_TEAM_ID)),
        Optional.ofNullable(r.get(CANDIDATES.SCOUT_BRANCH)).map(ScoutBranch::valueOf));
  }
}
