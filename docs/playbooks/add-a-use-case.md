# Add a use case

Step-by-step recipe for introducing a new feature-public use case. Item #8 of [`docs/technical/agent-friendliness-audit.md`](../technical/agent-friendliness-audit.md).

A "use case" is a single piece of application behavior exposed through an interface and consumed by a controller, another use case, or a test. This playbook walks the canonical shape by citing [`CreateLeague`](../../src/main/java/app/zoneblitz/league/CreateLeague.java) — the simplest fully-worked example in the codebase.

See also [`CLAUDE.md`](../../CLAUDE.md) sections: **ITDD**, **Single responsibility**, **Error handling**, **Testcontainers discipline**.

---

## 1. Scope the use case to one public method

One class, one interface, one public method. `CreateLeague` exposes `create(...)`; `HireCandidate` exposes `hire(...)`; `AdvancePhase` exposes `advance(...)`. Resist the urge to bundle related operations — split them.

When a cohesive aggregate genuinely warrants two tightly-linked methods (e.g. [`AdvanceDay`](../../src/main/java/app/zoneblitz/league/AdvanceDay.java) exposes both `advance` and `tickKeepingPhase`), that is fine. When in doubt, split.

## 2. Create the interface

File: `src/main/java/app/zoneblitz/<feature>/<Name>.java`. **Public** visibility. Javadoc the contract — every return-type meaning, every `Result` variant, every pre-condition.

Canonical example, [`CreateLeague.java`](../../src/main/java/app/zoneblitz/league/CreateLeague.java):

```java
package app.zoneblitz.league;

public interface CreateLeague {

  /**
   * Create a new league owned by {@code ownerSubject}, with the 8 teams materialized — one owned by
   * the user (via {@code franchiseId}) and seven CPU.
   *
   * @return {@link CreateLeagueResult.Created} on success; {@link CreateLeagueResult.NameTaken} if
   *     the user already has a league with this name (case-insensitive); {@link
   *     CreateLeagueResult.UnknownFranchise} if {@code franchiseId} does not resolve.
   */
  CreateLeagueResult create(String ownerSubject, String name, long franchiseId);
}
```

Every `Result` variant gets a Javadoc `@link` so consumers (and agents) see them in the interface's view.

## 3. Create the sealed `Result` union

File: `src/main/java/app/zoneblitz/<feature>/<Name>Result.java`. Public sealed interface, records as variants. One variant per outcome the caller must branch on.

Canonical, [`CreateLeagueResult.java`](../../src/main/java/app/zoneblitz/league/CreateLeagueResult.java):

```java
package app.zoneblitz.league;

public sealed interface CreateLeagueResult {

  record Created(League league) implements CreateLeagueResult {}

  record NameTaken(String name) implements CreateLeagueResult {}

  record UnknownFranchise(long franchiseId) implements CreateLeagueResult {}
}
```

Consumers handle every variant via an exhaustive switch expression; the compiler enforces coverage.

## 4. Implement

File: `src/main/java/app/zoneblitz/<feature>/<Name>UseCase.java`. **Package-private** for new code.

> The existing canonical examples (`CreateLeagueUseCase`, `HireCandidateUseCase`, `AdvancePhaseUseCase`, `AdvanceDayUseCase`) are currently marked `public` — they predate the encapsulation rule called out in the [audit](../technical/agent-friendliness-audit.md#1-a-weak-agent-cant-find-the-front-door-of-a-feature). New implementations should be package-private. The interface is the feature's public surface; the implementation should not be.

Constructor-inject dependencies **typed as their interfaces**, not concrete types. Add `@Service` at the class level. Add `@Transactional` at the class level (or per-method) when the use case writes.

Canonical shape, [`CreateLeagueUseCase.java`](../../src/main/java/app/zoneblitz/league/CreateLeagueUseCase.java):

```java
package app.zoneblitz.league;

import app.zoneblitz.league.franchise.FranchiseRepository;
import app.zoneblitz.league.phase.LeaguePhase;
import app.zoneblitz.league.team.TeamDraft;
import app.zoneblitz.league.team.TeamRepository;
import java.util.ArrayList;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class CreateLeagueUseCase implements CreateLeague {

  private final LeagueRepository leagues;
  private final FranchiseRepository franchises;
  private final TeamRepository teams;

  CreateLeagueUseCase(
      LeagueRepository leagues, FranchiseRepository franchises, TeamRepository teams) {
    this.leagues = leagues;
    this.franchises = franchises;
    this.teams = teams;
  }

  @Override
  @Transactional
  public CreateLeagueResult create(String ownerSubject, String name, long franchiseId) {
    Objects.requireNonNull(ownerSubject, "ownerSubject");
    Objects.requireNonNull(name, "name");
    var trimmed = name.trim();

    if (franchises.findById(franchiseId).isEmpty()) {
      return new CreateLeagueResult.UnknownFranchise(franchiseId);
    }
    if (leagues.existsByOwnerAndName(ownerSubject, trimmed)) {
      return new CreateLeagueResult.NameTaken(trimmed);
    }

    // ... do the work, return CreateLeagueResult.Created
    var settings = LeagueSettings.defaults();
    var league = leagues.insert(ownerSubject, trimmed, LeaguePhase.INITIAL_SETUP, settings);
    return new CreateLeagueResult.Created(league);
  }
}
```

Note `Objects.requireNonNull` at the public boundary, and `Optional` used at the repository API rather than nullable returns (per `CLAUDE.md` **Null handling**).

## 5. Register with Spring

`@Service` / `@Component` on the package-private class is enough — Spring component scanning picks it up. No manual wiring needed for the simple case.

Use an explicit `@Bean` method only when construction needs arguments that Spring cannot resolve itself (e.g. a phase enum parameter selecting which market to serve). See [`LeagueBeans.java`](../../src/main/java/app/zoneblitz/league/LeagueBeans.java) for the pattern — one `CpuTeamStrategy` bean per hiring phase wired via explicit `@Bean` methods.

## 6. Wire into a controller (if user-facing)

Controllers stay thin: parse the request, delegate to the use case, render. Inject the **interface type**, never the implementation.

From [`LeagueController.java`](../../src/main/java/app/zoneblitz/league/LeagueController.java):

```java
@Controller
public class LeagueController {

  private final CreateLeague createLeague;          // interface type
  // ... other use cases

  public LeagueController(CreateLeague createLeague, /* ... */) {
    this.createLeague = createLeague;
  }

  @PostMapping("/leagues")
  String create(/* ... */) {
    var result = createLeague.create(ownerSubject, form.name(), form.franchiseId());
    return switch (result) {
      case CreateLeagueResult.Created created -> /* redirect */;
      case CreateLeagueResult.NameTaken taken -> /* re-render with error */;
      case CreateLeagueResult.UnknownFranchise unknown -> /* re-render with error */;
    };
  }
}
```

The exhaustive switch is how every `Result` variant is forced to be handled.

## 7. Write the test

**DB-touching use cases run against real Postgres via Testcontainers. No `InMemory*Repository`, no Mockito-stubbed repos** — this is a hard rule, see [`CLAUDE.md`](../../CLAUDE.md#db-touching-code-always-uses-testcontainers).

Use `@JooqTest` + `@Import(PostgresTestcontainer.class)` (from [`src/test/java/app/zoneblitz/support/PostgresTestcontainer.java`](../../src/test/java/app/zoneblitz/support/PostgresTestcontainer.java)). Construct the use case manually in `@BeforeEach` with real `Jooq*Repository` instances.

Test method naming: `methodUnderTest_condition_expectedOutcome`.

Canonical, [`CreateLeagueUseCaseTests.java`](../../src/test/java/app/zoneblitz/league/CreateLeagueUseCaseTests.java):

```java
@JooqTest
@Import(PostgresTestcontainer.class)
class CreateLeagueUseCaseTests {

  @Autowired DSLContext dsl;

  private CreateLeague createLeague;                 // interface type
  private FranchiseRepository franchises;
  private LeagueRepository leagues;

  @BeforeEach
  void setUp() {
    franchises = new JooqFranchiseRepository(dsl);
    leagues = new JooqLeagueRepository(dsl);
    createLeague = new CreateLeagueUseCase(leagues, franchises, new JooqTeamRepository(dsl));
  }

  @Test
  void create_whenValid_createsLeagueWithInitialSetupPhaseAndDefaultSettings() {
    var franchiseId = franchises.listAll().getFirst().id();

    var result = createLeague.create("sub-1", "Dynasty", franchiseId);

    assertThat(result).isInstanceOf(CreateLeagueResult.Created.class);
    var league = ((CreateLeagueResult.Created) result).league();
    assertThat(league.phase()).isEqualTo(LeaguePhase.INITIAL_SETUP);
  }

  @Test
  void create_whenOwnerAlreadyHasLeagueWithSameNameCaseInsensitive_returnsNameTaken() { /* ... */ }

  @Test
  void create_whenFranchiseDoesNotExist_returnsUnknownFranchiseAndWritesNothing() { /* ... */ }
}
```

Note the `private CreateLeague createLeague;` field — the variable is typed as the **interface**, not the concrete class. The concrete type appears once, at construction.

One test per outcome: at minimum, one per `Result` variant, plus one per branching condition inside the success path.

## Checklist — done when

- [ ] Interface defined in feature package with Javadoc describing contract + every `Result` variant.
- [ ] `Result` sealed interface with record variants covering every outcome callers must distinguish.
- [ ] Package-private implementation class annotated `@Service`, with `@Transactional` if it writes.
- [ ] Dependencies constructor-injected and typed as interfaces (not concrete types).
- [ ] `Objects.requireNonNull` on public-boundary non-null parameters.
- [ ] Tests against the interface type with `@JooqTest` + `@Import(PostgresTestcontainer.class)` for DB-touching use cases.
- [ ] One test per `Result` variant. Test names follow `method_condition_outcome`.
- [ ] Controller (if any) injects the interface, branches on the sealed `Result` via exhaustive switch.
- [ ] `./gradlew spotlessApply` run; `./gradlew spotlessCheck` passes.
- [ ] `./gradlew test` passes.
