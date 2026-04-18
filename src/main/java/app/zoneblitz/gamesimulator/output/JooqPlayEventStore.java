package app.zoneblitz.gamesimulator.output;

import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.name;
import static org.jooq.impl.DSL.table;

import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.JSONB;
import org.jooq.Table;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * jOOQ-backed adapter for {@link PlayEventStore}. Uses the typesafe DSL over a hand-written table
 * reference (generated sources are not committed for this table).
 */
@Component
@DependsOn("flyway")
class JooqPlayEventStore implements PlayEventStore {

  private static final Table<?> PLAY_EVENTS = table(name("play_events"));
  private static final Field<UUID> GAME_ID = field(name("play_events", "game_id"), UUID.class);
  private static final Field<Integer> PLAY_INDEX =
      field(name("play_events", "play_index"), Integer.class);
  private static final Field<JSONB> PAYLOAD = field(name("play_events", "payload"), JSONB.class);

  private final DSLContext dsl;
  private final ObjectMapper mapper;

  JooqPlayEventStore(DSLContext dsl) {
    this.dsl = Objects.requireNonNull(dsl, "dsl");
    this.mapper = PlayEventObjectMapper.create();
  }

  @Override
  @Transactional
  public void append(GameId gameId, List<PlayEvent> events) {
    Objects.requireNonNull(gameId, "gameId");
    Objects.requireNonNull(events, "events");
    if (events.isEmpty()) {
      return;
    }
    var insert = dsl.insertInto(PLAY_EVENTS).columns(GAME_ID, PLAY_INDEX, PAYLOAD);
    for (var event : events) {
      if (!event.gameId().equals(gameId)) {
        throw new IllegalArgumentException(
            "event.gameId() %s does not match append gameId %s".formatted(event.gameId(), gameId));
      }
      insert = insert.values(gameId.value(), event.sequence(), JSONB.valueOf(serialize(event)));
    }
    insert.execute();
  }

  @Override
  public List<PlayEvent> loadByGameId(GameId gameId) {
    Objects.requireNonNull(gameId, "gameId");
    return dsl
        .select(PAYLOAD)
        .from(PLAY_EVENTS)
        .where(GAME_ID.eq(gameId.value()))
        .orderBy(PLAY_INDEX.asc())
        .fetch(PAYLOAD)
        .stream()
        .map(this::deserialize)
        .toList();
  }

  private String serialize(PlayEvent event) {
    try {
      return mapper.writeValueAsString(event);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("failed to serialize PlayEvent", e);
    }
  }

  private PlayEvent deserialize(JSONB payload) {
    try {
      return mapper.readValue(payload.data(), PlayEvent.class);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("failed to deserialize PlayEvent", e);
    }
  }
}
