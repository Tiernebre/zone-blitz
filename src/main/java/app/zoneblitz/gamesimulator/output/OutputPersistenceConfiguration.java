package app.zoneblitz.gamesimulator.output;

import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires Flyway against the application {@link DataSource} so migrations (including the {@code
 * play_events} table needed by {@link JooqPlayEventStore}) run at startup.
 *
 * <p>Spring Boot 4 no longer ships a Flyway auto-configuration; this bean fills that gap for the
 * zone-blitz application. The {@link Flyway} bean runs {@code migrate()} eagerly on creation so
 * anything that depends on the schema (jOOQ queries, repositories) sees a migrated database.
 */
@Configuration
class OutputPersistenceConfiguration {

  @Bean(initMethod = "migrate")
  Flyway flyway(DataSource dataSource) {
    return Flyway.configure()
        .dataSource(dataSource)
        .locations("classpath:db/migration")
        .baselineOnMigrate(true)
        .load();
  }
}
