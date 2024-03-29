package com.tiernebre.database;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.jooq.exception.DataAccessException;
import org.junit.jupiter.api.Test;

public final class JooqDslContextFactoryTest {

  @Test
  public void connectsToDatabase()
    throws DataAccessException, DatabaseConnectionError {
    var results = new JooqDslContextFactory(
      new DatabaseConnectionFactory(DatabaseConstants.CONFIGURATION)
    )
      .create()
      .resultQuery("SELECT 1")
      .fetch();
    assertEquals(1, results.size());
    assertEquals(1, results.get(0).getValue(0));
  }
}
