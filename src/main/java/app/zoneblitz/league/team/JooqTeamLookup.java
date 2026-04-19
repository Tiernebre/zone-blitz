package app.zoneblitz.league.team;

import static app.zoneblitz.jooq.Tables.TEAMS;

import java.util.List;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class JooqTeamLookup implements TeamLookup {

  private final DSLContext dsl;

  public JooqTeamLookup(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public List<Long> teamIdsForLeague(long leagueId) {
    return dsl.select(TEAMS.ID)
        .from(TEAMS)
        .where(TEAMS.LEAGUE_ID.eq(leagueId))
        .orderBy(TEAMS.ID.asc())
        .fetch(TEAMS.ID);
  }

  @Override
  public List<Long> cpuTeamIdsForLeague(long leagueId) {
    return dsl.select(TEAMS.ID)
        .from(TEAMS)
        .where(TEAMS.LEAGUE_ID.eq(leagueId))
        .and(TEAMS.OWNER_SUBJECT.isNull())
        .orderBy(TEAMS.ID.asc())
        .fetch(TEAMS.ID);
  }
}
