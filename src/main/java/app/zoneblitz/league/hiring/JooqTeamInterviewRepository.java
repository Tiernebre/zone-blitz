package app.zoneblitz.league.hiring;

import static app.zoneblitz.jooq.Tables.TEAM_INTERVIEWS;

import app.zoneblitz.league.phase.LeaguePhase;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class JooqTeamInterviewRepository implements TeamInterviewRepository {

  private final DSLContext dsl;

  public JooqTeamInterviewRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public TeamInterview insert(NewTeamInterview interview) {
    Objects.requireNonNull(interview, "interview");
    var record =
        dsl.insertInto(TEAM_INTERVIEWS)
            .set(TEAM_INTERVIEWS.TEAM_ID, interview.teamId())
            .set(TEAM_INTERVIEWS.CANDIDATE_ID, interview.candidateId())
            .set(TEAM_INTERVIEWS.PHASE, interview.phase().name())
            .set(TEAM_INTERVIEWS.PHASE_WEEK, interview.phaseWeek())
            .set(TEAM_INTERVIEWS.INTERVIEW_INDEX, interview.interviewIndex())
            .set(TEAM_INTERVIEWS.INTEREST_LEVEL, interview.interestLevel().name())
            .returning(TEAM_INTERVIEWS.fields())
            .fetchOne();
    return map(record);
  }

  @Override
  public int countForCandidate(long teamId, long candidateId, LeaguePhase phase) {
    return dsl.fetchCount(
        TEAM_INTERVIEWS,
        TEAM_INTERVIEWS
            .TEAM_ID
            .eq(teamId)
            .and(TEAM_INTERVIEWS.CANDIDATE_ID.eq(candidateId))
            .and(TEAM_INTERVIEWS.PHASE.eq(phase.name())));
  }

  @Override
  public int countForWeek(long teamId, LeaguePhase phase, int phaseWeek) {
    return dsl.fetchCount(
        TEAM_INTERVIEWS,
        TEAM_INTERVIEWS
            .TEAM_ID
            .eq(teamId)
            .and(TEAM_INTERVIEWS.PHASE.eq(phase.name()))
            .and(TEAM_INTERVIEWS.PHASE_WEEK.eq(phaseWeek)));
  }

  @Override
  public Optional<TeamInterview> find(long teamId, long candidateId, LeaguePhase phase) {
    return dsl.selectFrom(TEAM_INTERVIEWS)
        .where(TEAM_INTERVIEWS.TEAM_ID.eq(teamId))
        .and(TEAM_INTERVIEWS.CANDIDATE_ID.eq(candidateId))
        .and(TEAM_INTERVIEWS.PHASE.eq(phase.name()))
        .fetchOptional(this::map);
  }

  @Override
  public List<TeamInterview> findAllFor(long teamId, LeaguePhase phase) {
    return dsl.selectFrom(TEAM_INTERVIEWS)
        .where(TEAM_INTERVIEWS.TEAM_ID.eq(teamId))
        .and(TEAM_INTERVIEWS.PHASE.eq(phase.name()))
        .orderBy(TEAM_INTERVIEWS.ID.asc())
        .fetch(this::map);
  }

  private TeamInterview map(org.jooq.Record r) {
    return new TeamInterview(
        r.get(TEAM_INTERVIEWS.ID),
        r.get(TEAM_INTERVIEWS.TEAM_ID),
        r.get(TEAM_INTERVIEWS.CANDIDATE_ID),
        LeaguePhase.valueOf(r.get(TEAM_INTERVIEWS.PHASE)),
        r.get(TEAM_INTERVIEWS.PHASE_WEEK),
        r.get(TEAM_INTERVIEWS.INTERVIEW_INDEX),
        InterviewInterest.valueOf(r.get(TEAM_INTERVIEWS.INTEREST_LEVEL)));
  }
}
