package app.zoneblitz.league.franchise;

import static app.zoneblitz.jooq.Tables.CITIES;
import static app.zoneblitz.jooq.Tables.FRANCHISES;
import static app.zoneblitz.jooq.Tables.STATES;

import app.zoneblitz.league.geography.City;
import app.zoneblitz.league.geography.State;
import java.util.List;
import java.util.Optional;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

@Repository
public class JooqFranchiseRepository implements FranchiseRepository {

  private final DSLContext dsl;

  public JooqFranchiseRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  @Override
  public List<Franchise> listAll() {
    return dsl.select(
            FRANCHISES.ID,
            FRANCHISES.NAME,
            FRANCHISES.PRIMARY_COLOR,
            FRANCHISES.SECONDARY_COLOR,
            CITIES.ID,
            CITIES.NAME,
            STATES.ID,
            STATES.CODE,
            STATES.NAME)
        .from(FRANCHISES)
        .join(CITIES)
        .on(CITIES.ID.eq(FRANCHISES.CITY_ID))
        .join(STATES)
        .on(STATES.ID.eq(CITIES.STATE_ID))
        .orderBy(CITIES.NAME, FRANCHISES.NAME)
        .fetch(JooqFranchiseRepository::mapFranchise);
  }

  @Override
  public Optional<Franchise> findById(long id) {
    return dsl.select(
            FRANCHISES.ID,
            FRANCHISES.NAME,
            FRANCHISES.PRIMARY_COLOR,
            FRANCHISES.SECONDARY_COLOR,
            CITIES.ID,
            CITIES.NAME,
            STATES.ID,
            STATES.CODE,
            STATES.NAME)
        .from(FRANCHISES)
        .join(CITIES)
        .on(CITIES.ID.eq(FRANCHISES.CITY_ID))
        .join(STATES)
        .on(STATES.ID.eq(CITIES.STATE_ID))
        .where(FRANCHISES.ID.eq(id))
        .fetchOptional(JooqFranchiseRepository::mapFranchise);
  }

  public static Franchise mapFranchise(Record r) {
    var state = new State(r.get(STATES.ID), r.get(STATES.CODE), r.get(STATES.NAME));
    var city = new City(r.get(CITIES.ID), r.get(CITIES.NAME), state);
    return new Franchise(
        r.get(FRANCHISES.ID),
        r.get(FRANCHISES.NAME),
        city,
        r.get(FRANCHISES.PRIMARY_COLOR),
        r.get(FRANCHISES.SECONDARY_COLOR));
  }
}
