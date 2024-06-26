package com.tiernebre.league_management.league;

import com.tiernebre.database.JooqRepositoryPaginationStrategy;
import com.tiernebre.database.jooq.Tables;
import com.tiernebre.util.error.ZoneBlitzError;
import com.tiernebre.util.error.ZoneBlitzServerError;
import com.tiernebre.util.pagination.Page;
import com.tiernebre.util.pagination.PageRequest;
import io.vavr.control.Either;
import io.vavr.control.Option;
import io.vavr.control.Try;
import java.util.Collections;
import org.jooq.DSLContext;

public final class JooqLeagueRepository implements LeagueRepository {

  private final DSLContext dsl;
  private final JooqRepositoryPaginationStrategy paginationStrategy;

  public JooqLeagueRepository(
    DSLContext dsl,
    JooqRepositoryPaginationStrategy paginationStrategy
  ) {
    this.dsl = dsl;
    this.paginationStrategy = paginationStrategy;
  }

  @Override
  public Either<ZoneBlitzError, League> insertOne(InsertLeagueRequest request) {
    return Try.of(
      () ->
        dsl
          .insertInto(
            Tables.LEAGUE,
            Tables.LEAGUE.ACCOUNT_ID,
            Tables.LEAGUE.NAME
          )
          .values(request.accountId(), request.userRequest().name())
          .returning()
          .fetchSingleInto(League.class)
    )
      .toEither()
      .mapLeft(error -> new ZoneBlitzServerError(error.getMessage()));
  }

  @Override
  public Page<League> selectForAccount(long accountId, PageRequest request) {
    return paginationStrategy.seek(
      Tables.LEAGUE,
      Tables.LEAGUE.ID,
      request,
      League.class,
      Collections.singleton(Tables.LEAGUE.ACCOUNT_ID.eq(accountId))
    );
  }

  @Override
  public Option<League> selectOneForAccount(long id, long accountId) {
    return Option.of(
      dsl
        .selectFrom(Tables.LEAGUE)
        .where(Tables.LEAGUE.ID.eq(id))
        .and(Tables.LEAGUE.ACCOUNT_ID.eq(accountId))
        .fetchOneInto(League.class)
    );
  }
}
