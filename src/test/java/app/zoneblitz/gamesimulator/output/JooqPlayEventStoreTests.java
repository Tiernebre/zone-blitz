package app.zoneblitz.gamesimulator.output;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.name;
import static org.jooq.impl.DSL.table;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldGoalResult;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.IncompleteReason;
import app.zoneblitz.gamesimulator.event.PenaltyType;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.support.PostgresTestcontainer;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(PostgresTestcontainer.class)
class JooqPlayEventStoreTests {

  @Autowired private DSLContext dsl;

  private PlayEventStore store;

  private static final DownAndDistance DD = new DownAndDistance(1, 10);
  private static final FieldPosition SPOT = new FieldPosition(25);
  private static final GameClock CLOCK = new GameClock(1, 900);
  private static final Score SCORE = new Score(0, 0);

  @BeforeEach
  void setUp() {
    store = new JooqPlayEventStore(dsl);
    var tables =
        dsl.select(field("table_name", String.class))
            .from(table(name("information_schema", "tables")))
            .where(field("table_schema", String.class).eq("public"))
            .fetch(field("table_name", String.class));
    org.slf4j.LoggerFactory.getLogger(JooqPlayEventStoreTests.class)
        .info("TABLES IN TESTDB: {}", tables);
    dsl.deleteFrom(table(name("play_events"))).execute();
  }

  @Test
  void append_thenLoadByGameId_roundTripsVariants() {
    var gameId = new GameId(UUID.randomUUID());
    var qb = new PlayerId(UUID.randomUUID());
    var target = new PlayerId(UUID.randomUUID());
    var tackler = new PlayerId(UUID.randomUUID());
    var carrier = new PlayerId(UUID.randomUUID());
    var kicker = new PlayerId(UUID.randomUUID());

    var events =
        List.<PlayEvent>of(
            new PlayEvent.PassComplete(
                PlayId.random(),
                gameId,
                0,
                DD,
                SPOT,
                CLOCK,
                new GameClock(1, 895),
                SCORE,
                qb,
                target,
                8,
                3,
                11,
                new FieldPosition(36),
                Optional.of(tackler),
                List.of(tackler),
                false,
                true),
            new PlayEvent.PassIncomplete(
                PlayId.random(),
                gameId,
                1,
                new DownAndDistance(1, 10),
                new FieldPosition(36),
                new GameClock(1, 895),
                new GameClock(1, 890),
                SCORE,
                qb,
                target,
                15,
                IncompleteReason.DROPPED,
                Optional.empty()),
            new PlayEvent.Run(
                PlayId.random(),
                gameId,
                2,
                new DownAndDistance(2, 10),
                new FieldPosition(36),
                new GameClock(1, 890),
                new GameClock(1, 850),
                SCORE,
                carrier,
                RunConcept.INSIDE_ZONE,
                4,
                new FieldPosition(40),
                Optional.of(tackler),
                Optional.empty(),
                false,
                false,
                123456789L),
            new PlayEvent.FieldGoalAttempt(
                PlayId.random(),
                gameId,
                3,
                new DownAndDistance(4, 6),
                new FieldPosition(40),
                new GameClock(1, 850),
                new GameClock(1, 845),
                new Score(3, 0),
                kicker,
                48,
                FieldGoalResult.GOOD,
                Optional.empty()),
            new PlayEvent.Penalty(
                PlayId.random(),
                gameId,
                4,
                new DownAndDistance(1, 10),
                new FieldPosition(25),
                new GameClock(1, 845),
                new GameClock(1, 845),
                new Score(3, 0),
                PenaltyType.FALSE_START,
                Side.HOME,
                qb,
                5,
                true,
                Optional.empty()),
            new PlayEvent.Kneel(
                PlayId.random(),
                gameId,
                5,
                new DownAndDistance(1, 10),
                new FieldPosition(30),
                new GameClock(4, 5),
                new GameClock(4, 0),
                new Score(3, 0)));

    store.append(gameId, events);

    var loaded = store.loadByGameId(gameId);

    assertThat(loaded).hasSize(events.size());
    assertThat(loaded).containsExactlyElementsOf(events);
  }

  @Test
  void loadByGameId_whenNoEvents_returnsEmpty() {
    assertThat(store.loadByGameId(new GameId(UUID.randomUUID()))).isEmpty();
  }

  @Test
  void append_whenEventGameIdMismatch_throws() {
    var gameId = new GameId(UUID.randomUUID());
    var otherGame = new GameId(UUID.randomUUID());
    var event = new PlayEvent.Kneel(PlayId.random(), otherGame, 0, DD, SPOT, CLOCK, CLOCK, SCORE);

    assertThatThrownBy(() -> store.append(gameId, List.of(event)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void append_whenDuplicateSequence_violatesUniqueConstraint() {
    var gameId = new GameId(UUID.randomUUID());
    var kneel = new PlayEvent.Kneel(PlayId.random(), gameId, 0, DD, SPOT, CLOCK, CLOCK, SCORE);
    store.append(gameId, List.of(kneel));

    var duplicate = new PlayEvent.Kneel(PlayId.random(), gameId, 0, DD, SPOT, CLOCK, CLOCK, SCORE);
    assertThatThrownBy(() -> store.append(gameId, List.of(duplicate)))
        .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
  }

  @Test
  void payload_isQueryableAsJsonb() {
    var gameId = new GameId(UUID.randomUUID());
    var kicker = new PlayerId(UUID.randomUUID());
    var fg =
        new PlayEvent.FieldGoalAttempt(
            PlayId.random(),
            gameId,
            0,
            new DownAndDistance(4, 6),
            new FieldPosition(40),
            CLOCK,
            CLOCK,
            new Score(3, 0),
            kicker,
            48,
            FieldGoalResult.GOOD,
            Optional.empty());
    store.append(gameId, List.of(fg));

    var type =
        dsl.select(field("payload->>'@variant'", String.class))
            .from(table(name("play_events")))
            .where(field(name("play_events", "game_id"), UUID.class).eq(gameId.value()))
            .fetchOne(field("payload->>'@variant'", String.class));

    assertThat(type).isEqualTo("FieldGoalAttempt");
  }

  @Test
  void loadByGameId_returnsEventsInSequenceOrder() {
    var gameId = new GameId(UUID.randomUUID());
    var first = new PlayEvent.Kneel(PlayId.random(), gameId, 0, DD, SPOT, CLOCK, CLOCK, SCORE);
    var second = new PlayEvent.Spike(PlayId.random(), gameId, 1, DD, SPOT, CLOCK, CLOCK, SCORE);
    var third = new PlayEvent.Kneel(PlayId.random(), gameId, 2, DD, SPOT, CLOCK, CLOCK, SCORE);

    store.append(gameId, List.of(second));
    store.append(gameId, List.of(third));
    store.append(gameId, List.of(first));

    var loaded = store.loadByGameId(gameId);
    assertThat(loaded).extracting(PlayEvent::sequence).containsExactly(0, 1, 2);
  }
}
