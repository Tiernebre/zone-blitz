package app.zoneblitz.league;

import static app.zoneblitz.jooq.Tables.TEAMS;

import java.util.List;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
class JooqTeamLookup implements TeamLookup {

  private final DSLContext dsl;

  JooqTeamLookup(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public List<Long> franchiseIdsForLeague(long leagueId) {
    return dsl.select(TEAMS.FRANCHISE_ID)
        .from(TEAMS)
        .where(TEAMS.LEAGUE_ID.eq(leagueId))
        .orderBy(TEAMS.FRANCHISE_ID.asc())
        .fetch(TEAMS.FRANCHISE_ID);
  }

  @Override
  public List<Long> cpuFranchiseIdsForLeague(long leagueId) {
    return dsl.select(TEAMS.FRANCHISE_ID)
        .from(TEAMS)
        .where(TEAMS.LEAGUE_ID.eq(leagueId))
        .and(TEAMS.OWNER_SUBJECT.isNull())
        .orderBy(TEAMS.FRANCHISE_ID.asc())
        .fetch(TEAMS.FRANCHISE_ID);
  }
}
