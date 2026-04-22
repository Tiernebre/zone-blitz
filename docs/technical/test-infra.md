# Test infrastructure map

Pointer list for the test-side scaffolding. If you're about to hand-roll a container, a fake, or a builder, check here first — the thing probably already exists.

See CLAUDE.md ("Testing") for *policy*. This page is just *locations*.

## Shared fixtures

| What | Where | Used by |
|---|---|---|
| Postgres Testcontainer | [`support/PostgresTestcontainer.java`](../../src/test/java/app/zoneblitz/support/PostgresTestcontainer.java) — `@TestConfiguration`, `withReuse(true)`, `@ServiceConnection` | `@Import(PostgresTestcontainer.class)` into every `@JooqTest` / `@SpringBootTest` that touches the DB. Single container reused across the suite. |
| E2E auth stub | [`support/E2ETestAuth.java`](../../src/test/java/app/zoneblitz/support/E2ETestAuth.java) — stamps a fake `OAuth2AuthenticationToken` via `GET /test-auth/login?sub=…` | Playwright journeys. Imported alongside `@SpringBootTest(webEnvironment = RANDOM_PORT)`. |

## Fakes

Hand-written fakes live next to the tests that use them. Don't invent a new one if one of these fits.

| Port | Fake | Location | Notes |
|---|---|---|---|
| `RandomSource` (seeded/deterministic) | `FakeRandomSource` (Random-backed) | [`src/test/java/app/zoneblitz/league/FakeRandomSource.java`](../../src/test/java/app/zoneblitz/league/FakeRandomSource.java) | Public. Default for league tests — predictable seed, `split(key)` derives a child seed deterministically. |
| `RandomSource` (scripted draws) | `FakeRandomSource` (list-replay) | [`src/test/java/app/zoneblitz/gamesimulator/rng/FakeRandomSource.java`](../../src/test/java/app/zoneblitz/gamesimulator/rng/FakeRandomSource.java) | Package-private. Use when you need exact control over each `nextLong` / `nextDouble`. |
| `PersonnelSelector` | `FakePersonnelSelector` | [`src/test/java/app/zoneblitz/gamesimulator/personnel/FakePersonnelSelector.java`](../../src/test/java/app/zoneblitz/gamesimulator/personnel/FakePersonnelSelector.java) | Sim personnel selection fake. |

**No `InMemory*Repository` fakes exist — and none should.** CLAUDE.md "DB-touching code always uses Testcontainers" makes that policy binding: repositories and repository-backed use cases run against real Postgres via the shared `PostgresTestcontainer`. Do not hand-roll an `InMemoryLeagueRepository` or mock a `LeagueRepository` with Mockito.

## Test data builders

See [`src/test/java/app/zoneblitz/BUILDERS.md`](../../src/test/java/app/zoneblitz/BUILDERS.md) — authoritative table of available builders and the template for adding a new one. Brief summary:

- `aStaffContract()`, `anOfferTerms()`, `aNewTeamStaffMember()`, `aTeamDraft()`, `aTeamHiringState()`, `aTeamProfile()`.
- Builders are package-private, co-located with the record's tests, and ship plausible valid defaults.
- Add a new builder when a record starts getting constructed inline in more than a handful of tests. Update `BUILDERS.md` when you do.

## Slice-test recipes

### Repository (`Jooq*Repository`)

```java
@JooqTest
@Import(PostgresTestcontainer.class)
class JooqThingRepositoryTests {
  @Autowired DSLContext dsl;
  private ThingRepository repository; // interface type

  @BeforeEach
  void setUp() {
    repository = new JooqThingRepository(dsl);
  }
}
```

### Repository-backed use case

Same annotations. Wire the use case manually in `@BeforeEach` over a real `Jooq*Repository`. No Mockito-stubbed repo.

```java
@JooqTest
@Import(PostgresTestcontainer.class)
class CreateThingUseCaseTests {
  @Autowired DSLContext dsl;
  private CreateThing createThing; // interface type

  @BeforeEach
  void setUp() {
    var repository = new JooqThingRepository(dsl);
    createThing = new CreateThingUseCase(repository, new FakeRandomSource(42L));
  }
}
```

### Controller

```java
@WebMvcTest(ThingController.class)
class ThingControllerTests {
  @Autowired MockMvc mvc;
  @MockitoBean ViewThing viewThing; // interface type — the one place Mockito is expected
}
```

### Full-stack E2E (Playwright)

`@SpringBootTest(webEnvironment = RANDOM_PORT)` + `@Import({PostgresTestcontainer.class, E2ETestAuth.class})`. See existing `*E2ETest` classes for templates (`CreateLeagueE2ETest`, `StaffAssemblyE2ETest`).

## Naming convention

`methodUnderTest_condition_expectedOutcome`. Enforced by the `testMethods_followUnderscoreNamingConvention` ArchUnit rule in [`ArchitectureTests.java`](../../src/test/java/app/zoneblitz/architecture/ArchitectureTests.java) — a floor that requires at least one underscore in every `@Test` / `@ParameterizedTest` / `@RepeatedTest` method name. Aim for the full three-segment form.

## Running

```bash
./gradlew test                    # everything + JaCoCo
./gradlew test --tests '*Hiring*' # filter
./verify                          # spotlessApply → spotlessCheck → test (pre-done check)
./db-reset                        # wipe local Postgres + flywayMigrate + generateJooq
```

Coverage target: 85% (JaCoCo report at `build/reports/jacoco/test/html/index.html`).
