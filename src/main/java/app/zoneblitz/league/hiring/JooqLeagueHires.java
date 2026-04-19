package app.zoneblitz.league.hiring;

import static app.zoneblitz.jooq.Tables.CANDIDATES;
import static app.zoneblitz.jooq.Tables.CITIES;
import static app.zoneblitz.jooq.Tables.FRANCHISES;
import static app.zoneblitz.jooq.Tables.TEAMS;

import app.zoneblitz.league.hiring.LeagueHire.HiredCandidateBrief;
import app.zoneblitz.league.staff.SpecialtyPosition;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class JooqLeagueHires implements LeagueHires {

  private final DSLContext dsl;

  public JooqLeagueHires(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public List<LeagueHire> forLeaguePool(long leagueId, long userTeamId, long poolId) {
    var rows =
        dsl.select(
                TEAMS.ID,
                FRANCHISES.NAME,
                CITIES.NAME,
                CANDIDATES.ID,
                CANDIDATES.FIRST_NAME,
                CANDIDATES.LAST_NAME,
                CANDIDATES.ARCHETYPE,
                CANDIDATES.SPECIALTY_POSITION)
            .from(TEAMS)
            .join(FRANCHISES)
            .on(FRANCHISES.ID.eq(TEAMS.FRANCHISE_ID))
            .join(CITIES)
            .on(CITIES.ID.eq(FRANCHISES.CITY_ID))
            .leftJoin(CANDIDATES)
            .on(CANDIDATES.HIRED_BY_TEAM_ID.eq(TEAMS.ID).and(CANDIDATES.POOL_ID.eq(poolId)))
            .where(TEAMS.LEAGUE_ID.eq(leagueId))
            .fetch(
                r -> {
                  var teamId = r.get(TEAMS.ID);
                  var candidateId = r.get(CANDIDATES.ID);
                  Optional<HiredCandidateBrief> hire =
                      candidateId == null
                          ? Optional.empty()
                          : Optional.of(
                              new HiredCandidateBrief(
                                  candidateId,
                                  r.get(CANDIDATES.FIRST_NAME) + " " + r.get(CANDIDATES.LAST_NAME),
                                  CandidateArchetype.valueOf(r.get(CANDIDATES.ARCHETYPE)),
                                  SpecialtyPosition.valueOf(r.get(CANDIDATES.SPECIALTY_POSITION))));
                  return new LeagueHire(
                      teamId,
                      r.get(FRANCHISES.NAME),
                      r.get(CITIES.NAME),
                      teamId == userTeamId,
                      hire);
                });
    return rows.stream()
        .sorted(
            Comparator.comparing(LeagueHire::isViewerTeam)
                .reversed()
                .thenComparing(LeagueHire::cityName, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(LeagueHire::franchiseName, String.CASE_INSENSITIVE_ORDER))
        .toList();
  }
}
