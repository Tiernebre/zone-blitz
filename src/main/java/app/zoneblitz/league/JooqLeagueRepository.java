package app.zoneblitz.league;

import static app.zoneblitz.jooq.Tables.CITIES;
import static app.zoneblitz.jooq.Tables.FRANCHISES;
import static app.zoneblitz.jooq.Tables.LEAGUES;
import static app.zoneblitz.jooq.Tables.STATES;
import static app.zoneblitz.jooq.Tables.TEAMS;
import static org.jooq.impl.DSL.lower;

import java.util.List;
import java.util.Optional;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
class JooqLeagueRepository implements LeagueRepository {

  private final DSLContext dsl;

  JooqLeagueRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public League insert(
      String ownerSubject, String name, LeaguePhase phase, LeagueSettings settings) {
    var record =
        dsl.insertInto(LEAGUES)
            .set(LEAGUES.NAME, name)
            .set(LEAGUES.OWNER_SUBJECT, ownerSubject)
            .set(LEAGUES.PHASE, phase.name())
            .set(LEAGUES.TEAM_COUNT, settings.teamCount())
            .set(LEAGUES.SEASON_GAMES, settings.seasonGames())
            .returning(
                LEAGUES.ID,
                LEAGUES.NAME,
                LEAGUES.OWNER_SUBJECT,
                LEAGUES.PHASE,
                LEAGUES.TEAM_COUNT,
                LEAGUES.SEASON_GAMES,
                LEAGUES.CREATED_AT)
            .fetchOne();
    return new League(
        record.getId(),
        record.getName(),
        record.getOwnerSubject(),
        LeaguePhase.valueOf(record.getPhase()),
        new LeagueSettings(record.getTeamCount(), record.getSeasonGames()),
        record.getCreatedAt().toInstant());
  }

  @Override
  public boolean existsByOwnerAndName(String ownerSubject, String name) {
    return dsl.fetchExists(
        dsl.selectOne()
            .from(LEAGUES)
            .where(LEAGUES.OWNER_SUBJECT.eq(ownerSubject))
            .and(lower(LEAGUES.NAME).eq(name.toLowerCase())));
  }

  @Override
  public List<LeagueSummary> findSummariesFor(String ownerSubject) {
    return dsl.select(
            LEAGUES.ID,
            LEAGUES.NAME,
            LEAGUES.PHASE,
            LEAGUES.CREATED_AT,
            FRANCHISES.ID,
            FRANCHISES.NAME,
            FRANCHISES.PRIMARY_COLOR,
            FRANCHISES.SECONDARY_COLOR,
            CITIES.ID,
            CITIES.NAME,
            STATES.ID,
            STATES.CODE,
            STATES.NAME)
        .from(LEAGUES)
        .join(TEAMS)
        .on(TEAMS.LEAGUE_ID.eq(LEAGUES.ID))
        .and(TEAMS.OWNER_SUBJECT.eq(LEAGUES.OWNER_SUBJECT))
        .join(FRANCHISES)
        .on(FRANCHISES.ID.eq(TEAMS.FRANCHISE_ID))
        .join(CITIES)
        .on(CITIES.ID.eq(FRANCHISES.CITY_ID))
        .join(STATES)
        .on(STATES.ID.eq(CITIES.STATE_ID))
        .where(LEAGUES.OWNER_SUBJECT.eq(ownerSubject))
        .orderBy(LEAGUES.CREATED_AT.desc())
        .fetch(
            r ->
                new LeagueSummary(
                    r.get(LEAGUES.ID),
                    r.get(LEAGUES.NAME),
                    LeaguePhase.valueOf(r.get(LEAGUES.PHASE)),
                    r.get(LEAGUES.CREATED_AT).toInstant(),
                    JooqFranchiseRepository.mapFranchise(r)));
  }

  @Override
  public Optional<LeagueSummary> findSummaryByIdAndOwner(long id, String ownerSubject) {
    return dsl.select(
            LEAGUES.ID,
            LEAGUES.NAME,
            LEAGUES.PHASE,
            LEAGUES.CREATED_AT,
            FRANCHISES.ID,
            FRANCHISES.NAME,
            FRANCHISES.PRIMARY_COLOR,
            FRANCHISES.SECONDARY_COLOR,
            CITIES.ID,
            CITIES.NAME,
            STATES.ID,
            STATES.CODE,
            STATES.NAME)
        .from(LEAGUES)
        .join(TEAMS)
        .on(TEAMS.LEAGUE_ID.eq(LEAGUES.ID))
        .and(TEAMS.OWNER_SUBJECT.eq(LEAGUES.OWNER_SUBJECT))
        .join(FRANCHISES)
        .on(FRANCHISES.ID.eq(TEAMS.FRANCHISE_ID))
        .join(CITIES)
        .on(CITIES.ID.eq(FRANCHISES.CITY_ID))
        .join(STATES)
        .on(STATES.ID.eq(CITIES.STATE_ID))
        .where(LEAGUES.ID.eq(id))
        .and(LEAGUES.OWNER_SUBJECT.eq(ownerSubject))
        .fetchOptional(
            r ->
                new LeagueSummary(
                    r.get(LEAGUES.ID),
                    r.get(LEAGUES.NAME),
                    LeaguePhase.valueOf(r.get(LEAGUES.PHASE)),
                    r.get(LEAGUES.CREATED_AT).toInstant(),
                    JooqFranchiseRepository.mapFranchise(r)));
  }

  @Override
  public boolean deleteByIdAndOwner(long id, String ownerSubject) {
    return dsl.deleteFrom(LEAGUES)
            .where(LEAGUES.ID.eq(id))
            .and(LEAGUES.OWNER_SUBJECT.eq(ownerSubject))
            .execute()
        > 0;
  }
}
