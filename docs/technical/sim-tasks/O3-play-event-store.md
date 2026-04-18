# O3 — PlayEventStore

**Deps:** F1 (`PlayEvent` sealed union). **Bands:** none.

## Goal

Persist the event stream emitted by the simulation engine as the source of truth for a game. Box
scores, drive charts and historical views all derive from this table (see
[`sim-engine.md`](../sim-engine.md) lines 548-552).

Schema uses a JSONB payload column: schema evolution is easier than per-variant typed tables, and
we don't query across variant fields much in v1.

## Doc context

- `sim-engine.md` lines 540-552 (event persistence, source-of-truth framing).

## Owns

- `src/main/java/app/zoneblitz/gamesimulator/output/PlayEventStore.java` — interface:
  `append(gameId, events)`, `loadByGameId(gameId)`.
- `src/main/java/app/zoneblitz/gamesimulator/output/JooqPlayEventStore.java` — package-private
  adapter, typesafe jOOQ DSL, Jackson serialization.
- `src/main/java/app/zoneblitz/gamesimulator/output/PlayEventObjectMapper.java` — ObjectMapper
  factory. Registers `PlayEvent` subtypes via a Jackson mix-in so the sealed interface file stays
  untouched.
- `src/main/resources/db/migration/V2__create_play_events.sql` — `play_events` table with JSONB
  `payload`, unique `(game_id, play_index)`.
- `src/test/java/app/zoneblitz/gamesimulator/output/JooqPlayEventStoreTests.java` —
  `@SpringBootTest` + Testcontainers Postgres. Round-trips multiple variants, asserts JSONB is
  queryable (`payload->>'type'`).
- `src/test/resources/application.yml` — enables Flyway for the test profile.
- `build.gradle.kts` — adds `jackson-databind` + `jackson-datatype-jdk8` to the main
  implementation config (needed for `Optional<T>` fields on `PlayEvent` variants).

## Forbidden

- Editing `PlayEvent` sealed declaration. Jackson subtype registration is done via a mix-in in
  `PlayEventObjectMapper`; no annotations were added to `PlayEvent.java`.
- Raw SQL in production code. `JooqPlayEventStore` uses the typesafe DSL (`DSL.table`,
  `DSL.field`, typed insert/select). The test layer uses `payload->>'type'` inside a jOOQ
  `field(...)` expression purely for assertion purposes.
- Editing O1/O2/resolver/special-teams files or `compose.yaml`.
- Editing the existing `V1__init.sql` migration.

## Schema

```sql
CREATE TABLE play_events (
    id BIGSERIAL PRIMARY KEY,
    game_id UUID NOT NULL,
    play_index INTEGER NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT play_events_game_play_unique UNIQUE (game_id, play_index)
);
CREATE INDEX play_events_game_id_idx ON play_events (game_id, play_index);
```

`play_index` mirrors `PlayEvent.sequence()`. The unique constraint enforces the determinism
invariant (`(gameId, sequence)` uniquely identifies an event).

## Jackson approach

The sealed `PlayEvent` interface carries no Jackson annotations — it lives in the framework-free
`gamesimulator` source set. Polymorphic (de)serialization is wired via a Jackson mix-in
(`@JsonTypeInfo` + `@JsonSubTypes`) registered on the `ObjectMapper`. The type tag is the
variant's simple class name and serialized into a `type` JSON property.

`Optional<T>` fields (e.g. `Optional<PlayerId> tackler`, `Optional<PlayEvent> underlyingPlay`) use
the `Jdk8Module` so they round-trip correctly.

## Generated jOOQ sources

The project does not commit generated jOOQ sources (`build/generated-src/jooq/main` is
gitignored, and no package `app.zoneblitz.jooq` exists in `src/main/java`). `JooqPlayEventStore`
therefore references the `play_events` table via `DSL.table(name("play_events"))` +
`DSL.field(...)` — still typesafe DSL, no raw SQL strings.

## Tests

1. `append_thenLoadByGameId_roundTripsVariants` — six variants (PassComplete, PassIncomplete, Run,
   FieldGoalAttempt, Penalty, Kneel) round-trip byte-for-byte through the store.
2. `loadByGameId_whenNoEvents_returnsEmpty` — empty list, never null.
3. `append_whenEventGameIdMismatch_throws` — guard against caller wiring errors.
4. `append_whenDuplicateSequence_violatesUniqueConstraint` — append-only invariant.
5. `payload_isQueryableAsJsonb` — `SELECT payload->>'type'` returns the variant tag.
6. `loadByGameId_returnsEventsInSequenceOrder` — events come back sorted even when appended out of
   order.

## Definition of done

- `./gradlew spotlessApply && ./gradlew spotlessCheck test` green.
- `git diff --stat` touches only files listed in **Owns**.
