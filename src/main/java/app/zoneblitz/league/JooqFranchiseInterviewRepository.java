package app.zoneblitz.league;

import static app.zoneblitz.jooq.Tables.FRANCHISE_INTERVIEWS;

import java.util.List;
import java.util.Objects;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
class JooqFranchiseInterviewRepository implements FranchiseInterviewRepository {

  private final DSLContext dsl;

  JooqFranchiseInterviewRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public FranchiseInterview insert(NewFranchiseInterview interview) {
    Objects.requireNonNull(interview, "interview");
    var record =
        dsl.insertInto(FRANCHISE_INTERVIEWS)
            .set(FRANCHISE_INTERVIEWS.LEAGUE_ID, interview.leagueId())
            .set(FRANCHISE_INTERVIEWS.FRANCHISE_ID, interview.franchiseId())
            .set(FRANCHISE_INTERVIEWS.CANDIDATE_ID, interview.candidateId())
            .set(FRANCHISE_INTERVIEWS.PHASE, interview.phase().name())
            .set(FRANCHISE_INTERVIEWS.PHASE_WEEK, interview.phaseWeek())
            .set(FRANCHISE_INTERVIEWS.INTERVIEW_INDEX, interview.interviewIndex())
            .set(FRANCHISE_INTERVIEWS.SCOUTED_OVERALL, interview.scoutedOverall())
            .returning(FRANCHISE_INTERVIEWS.fields())
            .fetchOne();
    return map(record);
  }

  @Override
  public int countForCandidate(
      long leagueId, long franchiseId, long candidateId, LeaguePhase phase) {
    return dsl.fetchCount(
        FRANCHISE_INTERVIEWS,
        FRANCHISE_INTERVIEWS
            .LEAGUE_ID
            .eq(leagueId)
            .and(FRANCHISE_INTERVIEWS.FRANCHISE_ID.eq(franchiseId))
            .and(FRANCHISE_INTERVIEWS.CANDIDATE_ID.eq(candidateId))
            .and(FRANCHISE_INTERVIEWS.PHASE.eq(phase.name())));
  }

  @Override
  public int countForWeek(long leagueId, long franchiseId, LeaguePhase phase, int phaseWeek) {
    return dsl.fetchCount(
        FRANCHISE_INTERVIEWS,
        FRANCHISE_INTERVIEWS
            .LEAGUE_ID
            .eq(leagueId)
            .and(FRANCHISE_INTERVIEWS.FRANCHISE_ID.eq(franchiseId))
            .and(FRANCHISE_INTERVIEWS.PHASE.eq(phase.name()))
            .and(FRANCHISE_INTERVIEWS.PHASE_WEEK.eq(phaseWeek)));
  }

  @Override
  public List<FranchiseInterview> findAllFor(long leagueId, long franchiseId, LeaguePhase phase) {
    return dsl.selectFrom(FRANCHISE_INTERVIEWS)
        .where(FRANCHISE_INTERVIEWS.LEAGUE_ID.eq(leagueId))
        .and(FRANCHISE_INTERVIEWS.FRANCHISE_ID.eq(franchiseId))
        .and(FRANCHISE_INTERVIEWS.PHASE.eq(phase.name()))
        .orderBy(FRANCHISE_INTERVIEWS.ID.asc())
        .fetch(this::map);
  }

  private FranchiseInterview map(org.jooq.Record r) {
    return new FranchiseInterview(
        r.get(FRANCHISE_INTERVIEWS.ID),
        r.get(FRANCHISE_INTERVIEWS.LEAGUE_ID),
        r.get(FRANCHISE_INTERVIEWS.FRANCHISE_ID),
        r.get(FRANCHISE_INTERVIEWS.CANDIDATE_ID),
        LeaguePhase.valueOf(r.get(FRANCHISE_INTERVIEWS.PHASE)),
        r.get(FRANCHISE_INTERVIEWS.PHASE_WEEK),
        r.get(FRANCHISE_INTERVIEWS.INTERVIEW_INDEX),
        r.get(FRANCHISE_INTERVIEWS.SCOUTED_OVERALL));
  }
}
