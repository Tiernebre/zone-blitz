package app.zoneblitz.league.team;

import static app.zoneblitz.jooq.Tables.TEAMS;

import java.util.List;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class JooqTeamRepository implements TeamRepository {

  private final DSLContext dsl;

  public JooqTeamRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public void insertAll(long leagueId, List<TeamDraft> drafts) {
    var insert =
        dsl.insertInto(TEAMS).columns(TEAMS.LEAGUE_ID, TEAMS.FRANCHISE_ID, TEAMS.OWNER_SUBJECT);
    for (var draft : drafts) {
      insert = insert.values(leagueId, draft.franchiseId(), draft.ownerSubject().orElse(null));
    }
    insert.execute();
  }
}
