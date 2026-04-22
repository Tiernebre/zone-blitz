# Add a league phase

Step-by-step recipe for adding a new phase to the league state machine. Item #8 of [`docs/technical/agent-friendliness-audit.md`](../technical/agent-friendliness-audit.md).

Phases are lockstep across all franchises in a league and advance via the `AdvancePhase` use case. Each phase can own an entry/exit hook by implementing [`PhaseTransitionHandler`](../../src/main/java/app/zoneblitz/league/phase/PhaseTransitionHandler.java). See [`docs/technical/league-phases.md`](../technical/league-phases.md) for the state-machine design.

---

## 1. Add the enum variant

File: [`src/main/java/app/zoneblitz/league/phase/LeaguePhase.java`](../../src/main/java/app/zoneblitz/league/phase/LeaguePhase.java).

```java
public enum LeaguePhase {
  INITIAL_SETUP("Initial Setup"),
  HIRING_HEAD_COACH("Hiring Head Coach"),
  HIRING_DIRECTOR_OF_SCOUTING("Hiring Director of Scouting"),
  EXPANSION_DRAFT_SCOUTING("Expansion Draft Scouting"),
  ASSEMBLING_STAFF("Assembling Staff"),
  // add your new variant here, in intended chronological order
  COMPLETE("Complete");
  // ...
}
```

Adding a variant will break every exhaustive `switch` on `LeaguePhase` in the codebase — intentionally. The compiler lists them for you. Fix each one explicitly rather than adding a `default` branch. Common sites to check: [`HiringPhases.java`](../../src/main/java/app/zoneblitz/league/phase/HiringPhases.java), [`LeagueController.landingPathFor`](../../src/main/java/app/zoneblitz/league/LeagueController.java), [`AdvanceDayUseCase.allTeamsHired`](../../src/main/java/app/zoneblitz/league/AdvanceDayUseCase.java).

## 2. Wire ordering and day cap

File: [`src/main/java/app/zoneblitz/league/phase/LeaguePhases.java`](../../src/main/java/app/zoneblitz/league/phase/LeaguePhases.java).

Insert your new variant into the `NEXT` map and (if the phase has a day cap) `MAX_DAYS`:

```java
private static final Map<LeaguePhase, LeaguePhase> NEXT =
    Map.of(
        LeaguePhase.INITIAL_SETUP, LeaguePhase.HIRING_HEAD_COACH,
        LeaguePhase.HIRING_HEAD_COACH, LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING,
        // ...
        );

private static final Map<LeaguePhase, Integer> MAX_DAYS =
    Map.of(
        LeaguePhase.HIRING_HEAD_COACH, 21,
        LeaguePhase.HIRING_DIRECTOR_OF_SCOUTING, 21,
        LeaguePhase.ASSEMBLING_STAFF, 1);
```

Omit the phase from `MAX_DAYS` if it is user-advanced with no cap (like `INITIAL_SETUP`).

## 3. Implement a `PhaseTransitionHandler` (if the phase owns lifecycle state)

Skip this step only if your phase is a pure marker with no entry/exit behavior.

[`PhaseTransitionHandler`](../../src/main/java/app/zoneblitz/league/phase/PhaseTransitionHandler.java) is the seam:

```java
public interface PhaseTransitionHandler {

  /** The phase this handler owns. */
  LeaguePhase phase();

  /** Called when a league is leaving this handler's {@link #phase()}. Default no-op. */
  default void onExit(long leagueId) {}

  /** Called when a league is entering this handler's {@link #phase()}. Default no-op. */
  default void onEntry(long leagueId) {}
}
```

Handlers are keyed by the phase they own. `AdvancePhaseUseCase` collects them by injecting `List<PhaseTransitionHandler>` and building a `Map<LeaguePhase, PhaseTransitionHandler>` keyed by `phase()` — see [`AdvancePhaseUseCase.java:21-26`](../../src/main/java/app/zoneblitz/league/phase/AdvancePhaseUseCase.java).

Canonical, [`HiringHeadCoachTransitionHandler.java`](../../src/main/java/app/zoneblitz/league/phase/HiringHeadCoachTransitionHandler.java):

```java
@Component
public class HiringHeadCoachTransitionHandler implements PhaseTransitionHandler {

  private final LeagueRepository leagues;
  private final TeamLookup teams;
  // ... other collaborators, all interface types

  public HiringHeadCoachTransitionHandler(/* constructor-inject */) { /* ... */ }

  @Override
  public LeaguePhase phase() {
    return LeaguePhase.HIRING_HEAD_COACH;
  }

  @Override
  public void onEntry(long leagueId) {
    if (pools.findByLeaguePhaseAndType(leagueId, phase(), CandidatePoolType.HEAD_COACH).isPresent()) {
      log.debug("HC pool already present for league={}; entry is a no-op", leagueId);
      return;
    }
    // ... generate candidate pool, initialize team hiring states
  }
}
```

Guidance on the handler body:

- **Be idempotent.** Re-entry (via autofill, recovery) is a no-op if the expected artifacts already exist.
- **Only use the `RandomSource` seam**, never `Math.random` or `new Random()`. See [`CandidateRandomSources`](../../src/main/java/app/zoneblitz/league/hiring/CandidateRandomSources.java) for the pattern.
- **Keep the handler small.** If it exceeds ~200 LOC, extract helper classes (see [`HiringAssemblingStaffTransitionHandler.java`](../../src/main/java/app/zoneblitz/league/phase/HiringAssemblingStaffTransitionHandler.java) for the largest current example and its extraction candidates).

## 4. Register the handler

`@Component` on the handler class is sufficient — Spring picks it up and `AdvancePhaseUseCase` reads every `PhaseTransitionHandler` bean. No manual `@Bean` wiring is required.

## 5. Add a database migration (if the phase introduces schema)

File: `src/main/resources/db/migration/V<next>__description.sql`. Never edit an applied migration. The current highest is `V13__staff_contracts.sql`, so a new migration is `V14__<description>.sql`.

Check the latest migration before writing:

```bash
ls src/main/resources/db/migration/ | sort -V | tail -1
```

Naming follows `V<number>__lower_snake_case.sql`. Regenerate jOOQ sources after applying:

```bash
./gradlew flywayMigrate
./gradlew generateJooq
```

## 6. Controller routing (if the phase has a user-facing page)

[`LeagueController.landingPathFor`](../../src/main/java/app/zoneblitz/league/LeagueController.java:130) maps each phase to its dashboard landing URL:

```java
private static String landingPathFor(long id, LeaguePhase phase) {
  return switch (phase) {
    case HIRING_HEAD_COACH -> "/leagues/" + id + "/hiring/head-coach";
    case HIRING_DIRECTOR_OF_SCOUTING -> "/leagues/" + id + "/hiring/director-of-scouting";
    case ASSEMBLING_STAFF -> "/leagues/" + id + "/staff-recap";
    case INITIAL_SETUP, EXPANSION_DRAFT_SCOUTING, COMPLETE -> "/leagues/" + id;
  };
}
```

Adding a variant breaks this switch at compile time. Decide: new landing page, or route back to `/leagues/{id}`.

## 7. Write tests

For the handler: `@JooqTest` + `@Import(PostgresTestcontainer.class)`. Construct the handler with real `Jooq*Repository` instances in `@BeforeEach`. Call `onEntry` / `onExit` and assert database state.

For the phase transition itself: exercise [`AdvancePhaseUseCase`](../../src/main/java/app/zoneblitz/league/phase/AdvancePhaseUseCase.java) against the canonical pattern in [`AdvancePhaseUseCaseTests.java`](../../src/test/java/app/zoneblitz/league/phase/AdvancePhaseUseCaseTests.java):

```java
@JooqTest
@Import(PostgresTestcontainer.class)
class AdvancePhaseUseCaseTests {

  @Autowired DSLContext dsl;
  private AdvancePhase advancePhase;
  private RecordingHandler hiringHandler;  // fake handler for ordering assertions

  @BeforeEach
  void setUp() {
    leagues = new JooqLeagueRepository(dsl);
    hiringHandler = new RecordingHandler(LeaguePhase.HIRING_HEAD_COACH);
    advancePhase = new AdvancePhaseUseCase(leagues, List.of(hiringHandler, /* ... */));
  }

  @Test
  void advance_runsExitThenEntryHandlers() { /* assert ordering */ }
}
```

If the phase has a user-facing page, add a Playwright e2e test (critical journeys only — see `CLAUDE.md` **Playwright E2E**).

## 8. Update the design doc

Keep [`docs/technical/league-phases.md`](../technical/league-phases.md) in sync — the phase table at §Phases (v1 scope) lists each phase's purpose, user actions, and programmatic actions. Add your new row.

---

## Checklist — done when

- [ ] `LeaguePhase` enum variant added in chronological order.
- [ ] Every exhaustive `switch (LeaguePhase)` updated to handle the new variant (compiler-driven).
- [ ] `LeaguePhases.NEXT` wired; `MAX_DAYS` wired if the phase has a cap.
- [ ] `PhaseTransitionHandler` implementation (if the phase owns state) annotated `@Component`, idempotent, uses seeded RNG only.
- [ ] New migration `V<next>__description.sql` (if schema changed); `./gradlew flywayMigrate generateJooq` run.
- [ ] `LeagueController.landingPathFor` updated.
- [ ] `@JooqTest` handler test + `AdvancePhase` transition test.
- [ ] Playwright e2e added for any new user-facing page.
- [ ] `docs/technical/league-phases.md` updated.
- [ ] `./gradlew spotlessApply` run; `./gradlew spotlessCheck` passes.
- [ ] `./gradlew test` passes.
