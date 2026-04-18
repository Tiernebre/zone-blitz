# CLAUDE.md — Zone Blitz project conventions

This document captures the conventions for the Zone Blitz codebase. Follow it over defaults from training. When a rule here conflicts with general advice, this wins.

The overarching theme: **small, focused, composable code**. Files stay under 500 LOC (ideally much smaller). Every class has one responsibility. Looking in another file is cheap; navigating a 1000-line class is not.

---

## Stack

- Java 25, Spring Boot 4, Gradle (Kotlin DSL)
- jOOQ 3.19 + Flyway for persistence (Postgres)
- Thymeleaf + HTMX + Alpine + Tailwind for the web layer
- JUnit 5 + AssertJ + Testcontainers + Playwright for tests
- Spotless with google-java-format 1.28.0
- JaCoCo for coverage

---

## Language style

### Modernity

Lean hard into modern Java. Records, sealed interfaces, pattern matching, switch expressions, and text blocks are the default idioms — not edge cases.

### Records vs classes

- **Records always** for data: DTOs, requests, responses, domain values, events, sealed `Result` variants.
- Classes only when mutability is genuinely required.
- Never Lombok.

### `var`

- `var` for locals — yes, always.

### `final`

- `final` on fields of non-record classes. Records handle their own immutability.
- Not on method parameters or locals. `var final` is noise.

### Null handling

- **`Optional<T>` is the absence mechanism.** Never `@Nullable`, never nullable return types.
- `Optional` only as a **return type**. Never as a field, parameter, or collection element.
- Collections: return empty, never null.
- `Objects.requireNonNull` at public constructor/method boundaries for non-null params.
- jOOQ: prefer `fetchOptional()` over `fetchOne()`.

### Immutability & collections

- `List.of` / `Map.of` / `Set.of` for immutable literals.
- `.toList()` on streams (never `Collectors.toList()` — the old one returns a mutable `ArrayList`).
- Always rebuild collections; never mutate in place. If you genuinely need a mutable collection, use `.collect(Collectors.toCollection(ArrayList::new))` so the intent is explicit.

### Pattern matching

Use it everywhere it reads better than the alternative:

- `instanceof` pattern binding over cast-after-check — always.
- Switch expressions over `if/else` chains for type/value matching.
- Sealed interfaces for domain unions. Exhaustive switches catch missing cases at compile time.
- Record deconstruction when it clarifies intent.
- Handle `case null` in switches over nullable inputs.

### Text blocks

- Any string literal spanning more than one line.
- Use `.formatted(args)` for interpolation.
- Keep them at the call site; don't hoist to constants unless genuinely reused.

### Static imports

- ✅ From test libraries (AssertJ, JUnit, Mockito).
- ✅ From `java.util.Objects`, `java.util.stream.Collectors`, jOOQ DSL, and similarly well-known stdlib/3rd-party helpers.
- ❌ From any `app.zoneblitz.*` class. First-party statics are always qualified (`Strings.truncate(s)`, not `truncate(s)`). The class prefix *is* the information.

### Utility classes

Allowed when genuinely stateless: `final class`, private constructor, static methods. Always called qualified.

### Naming

- No `*Impl` suffix. Ever. Name implementations by their distinguishing trait: `JooqPlayerRepository`, `HttpEmailSender`, `InMemoryPlayerRepository`, `FakeClock`. `Default*` only as a last resort.
- No `*Manager`, `*Helper` — they're a smell that SRP was skipped. Actual utility classes are fine.
- Booleans: `isActive`, `hasPenalty`, `canPromote`.
- Collections: plural (`players`), never `playerList` / `playerCollection`.

---

## Interface-Test-Driven Development (ITDD)

**This is the core development discipline.** It combines three ideas:

1. **Interface-first design.** Every piece of behavior is defined by an interface before an implementation exists.
2. **Test-first.** Tests are written against the interface before the implementation.
3. **Code against interfaces, not concretes.** Parameters, fields, return types, and local variables are typed as the interface. Concrete types appear only at construction/wiring (`@Configuration`, factories, test `setUp`).

The payoff is concrete for a sim engine: swapping `PlayCaller`, `CoverageStrategy`, `FatigueModel`, `PenaltyModel`, or `RandomSource` implementations (e.g. probabilistic vs. deterministic for tests or calibration) is trivial because callers never knew the concrete type.

### Liberal interfaces

Create an interface for anything with **behavior**:

- Repositories, services, use cases, strategies, engine components.
- External ports: email, HTTP clients, clock, filesystem, RNG.
- Stat computation, simulation models.

Do **not** create interfaces for:

- Pure data (records for DTOs, requests, responses, domain values, events, sealed `Result` variants).
- Wiring (`@Configuration` classes).

### ITDD loop

1. Define the interface with method signatures and Javadoc describing the contract (return meanings, `Result` variants, invariants).
2. Write tests against the interface type. The concrete type appears only at construction in `setUp`.
3. Implement.

### Consuming code

When using code from elsewhere in the codebase, always depend on its interface. Concrete types are a smell in consumer code — the compiler should be able to see the interface everywhere.

Cross-feature consumption goes through a feature's **public API** (its use-case interfaces), never its internals. If `sim` needs roster data, it depends on a roster use case like `GetActiveRoster`, not on `PlayerRepository`. Repositories are feature-internal seams for testing and adapter-swapping, not cross-feature contracts.

### Test-typed variables

```java
class JooqPlayerRepositoryTests {
    private PlayerRepository repository; // interface type

    @BeforeEach
    void setUp() {
        repository = new JooqPlayerRepository(dsl);
    }
    // all tests exercise `repository` — the concrete type appears once, at construction
}
```

---

## Architecture & package layout

**Feature packages at the top level. Inside, prefer flat package-private encapsulation over ceremonial layer subpackages.**

```
app.zoneblitz.roster
  ├── RosterPage                    // public: the feature's use cases
  ├── AddPlayer                     // public: use-case interface
  ├── RemovePlayer                  // public: use-case interface
  ├── Player, RosterStatus, …       // public: domain records shared on the API
  ├── AddPlayerResult, …            // public: sealed Result unions
  │
  ├── PlayerRepository              // package-private: internal seam
  ├── JooqPlayerRepository          // package-private: adapter
  ├── AddPlayerUseCase              // package-private: implementation
  ├── RosterController              // package-private: web entry
  └── …request/response records, view models (package-private)
```

- **Interfaces live next to their implementations.** A feature-internal seam like `PlayerRepository` is package-private in the feature package — not hoisted into a `domain/` subpackage that forces it public.
- **A feature's public surface is its use-case interfaces and the records those use cases expose.** Everything else (repositories, controllers, adapters, implementations) is package-private. Java's `package-private` is the encapsulation boundary — use it.
- **Cross-feature contracts live in a shared package** (e.g. `app.zoneblitz.shared` or `app.zoneblitz.platform`) only when genuinely shared: `Clock`, `RandomSource`, cross-feature value types, the sealed exception hierarchy. "Would two+ features realistically depend on this?" is the bar. Err on the side of keeping it feature-local — promote later if a second consumer actually appears.
- **No per-feature `domain/` / `service/` / `data/` / `web/` subpackages.** They were adding public surface without adding encapsulation. If a feature genuinely outgrows a flat package, split it into sub-features, not layer folders.
- **Dependency direction:** features depend on `shared`, never on each other's internals. Feature-to-feature calls go through the target feature's public use-case interfaces.

### Single responsibility

- **Favor one class per use case.** `AddPlayer`, `RemovePlayer`, `PromoteFromPracticeSquad`, each implementing its own interface with one public method, is the default — it keeps classes small and makes swapping or testing a single behavior trivial. Not a hard rule: a tightly cohesive set of small operations on the same aggregate can sit on one interface when splitting would be pure ceremony. When in doubt, split.
- **Repositories stay thin.** One per aggregate root, only jOOQ calls. If query logic grows, extract query classes (`FindActivePlayersByTeam`) rather than fattening the repo.
- **Controllers stay thin.** One per resource/feature. Methods under ~30 lines. Extract view-model assembly to its own class when it grows.
- **500 LOC hard ceiling per file.** Extract freely.

### Layer discipline

- **Controllers** parse requests, delegate to services, render. No business logic. Never reference persistence types.
- **Services** own business logic. Return sealed `Result` unions for expected outcomes. Never reference HTTP types.
- **Repositories** wrap jOOQ. Map generated jOOQ records to domain records before returning — **jOOQ records never cross the data-layer boundary.**

### Dependency injection

- Constructor injection only. No field or setter `@Autowired`.
- `final` fields on services and components.

### DTOs

- Separate request/response records per endpoint. No reusing domain records on the wire.
- `jakarta.validation` annotations (`@NotBlank`, `@Email`, etc.) on request records.

---

## Error handling

Two complementary mechanisms:

### Sealed `Result` unions for expected domain outcomes

Push expected failure cases into the return type. Use cases return `sealed interface XResult permits Success, Reason1, Reason2, …`. Callers handle every variant via exhaustive switch expressions. Compiler enforces coverage.

```java
public sealed interface SignupResult {
    record Created(User user) implements SignupResult {}
    record EmailTaken(String email) implements SignupResult {}
    record InvalidPassword(String reason) implements SignupResult {}
}
```

### Custom domain exceptions for infrastructure/unexpected failures

A small sealed hierarchy (`NotFoundException`, `ConflictException`, `ValidationException`, etc.) mapped to semantic HTTP statuses via a single `@ControllerAdvice`. Errors should always map to the correct HTTP status — no generic 500s for things that should be 404/409/422.

### Checked exceptions

Wrap into unchecked at the boundary where they're handled. Don't scatter `catch (IOException e) { throw new RuntimeException(e); }` throughout the code — wrap once, at the adapter.

### Authorization failures

Use Spring Security defaults (401/403 via its handlers). No custom exception needed.

---

## Persistence

### jOOQ

- **Typesafe DSL only.** No raw SQL strings in production code.
- Repositories map jOOQ generated records to domain records. Generated `*Record` types never escape the repository — they stay inside the package-private adapter.

### Flyway

- One migration per logical change.
- **Never edit an applied migration.** Write a new one.
- Naming: `V001__create_players.sql`, `V002__add_roster_status.sql`.
- Migrations live in `src/main/resources/db/migration/`.

### Transactions

`@Transactional` on **services** (where use cases live). Never on repositories or controllers.

---

## Web layer (Thymeleaf + HTMX + Alpine + Tailwind)

### Templates

- Per-feature directories: `templates/<feature>/page.html`, `templates/<feature>/fragments.html`.
- Fragments co-located with their feature. No global `fragments/` dustbin.

### HTMX endpoints

- **Separate URLs for full pages vs fragments.** Don't branch on `HX-Request`.
  - `GET /roster` → full page
  - `GET /roster/rows` → fragment (the rows table body)
  - `POST /roster/players` → creates a player, returns the new `<tr>` fragment
  - `DELETE /roster/players/{id}` → deletes, returns empty or the updated row
- Page templates **compose the same fragments HTMX endpoints return** (`th:insert`). One source of truth per UI element.
- HTTP verbs reflect semantics (`POST` create, `DELETE` delete, `PATCH` update). HTMX responses are HTML fragments; the verb describes the action.
- Fragment endpoints return `text/html` with just the fragment — never wrapped in the page shell. The client decides placement via `hx-target` / `hx-swap`.
- Error responses also return fragments; the status code still matters (422 validation, 409 conflict). HTMX respects it.
- `hx-swap-oob` for cross-cutting updates (flash toast, nav badge). Use sparingly and document when used.
- **No JSON endpoints from web controllers.** If an API is needed, it lives in a separate `api/` package with its own controllers and records.

### Form validation

- Server-side via `@Valid` on the request record.
- Errors rendered into the same Thymeleaf template/fragment.
- HTMX swaps the form fragment on error with a 422.

### CSRF

Spring Security default enabled. HTMX configured with `hx-headers` to send the token.

### Alpine

- Not currently used. Add only for genuinely local interactivity (toggles, dropdowns, inline editing before submit).
- Server-authoritative for anything touching data — HTMX handles that.
- No global Alpine stores.

### Tailwind

- Utility classes in templates only. No `@apply` in CSS.
- Rebuilt via the `tailwindBuild` Gradle task (already wired into `processResources`).

---

## Security

- **OAuth2 login only.** No local password auth.
- **Method-level security** via `@PreAuthorize` on services (where the business rules live), not only at controllers.
- Authorization failures → Spring Security defaults (401/403).

---

## Testing

### Discipline

- **Test-first, always.** Write the failing test against the interface before the implementation exists.
- **Coverage target: 85%.** JaCoCo reports wired up in `build.gradle.kts`.

### Unit vs integration

- Bias toward many fast unit tests using fakes for interface dependencies.
- Smaller set of integration tests at the seams.

### Slice tests

- `@WebMvcTest` for controllers.
- `@DataJooqTest` for repositories.
- Full `@SpringBootTest` only when a slice isn't enough.

### Testcontainers

- Reusable containers across the suite. Configure `.withReuse(true)` + `~/.testcontainers.properties` locally.
- Single Postgres container shared by all DB-touching tests.

### Fakes over mocks

- Prefer hand-written fakes (`InMemoryPlayerRepository`, `FakeClock`, `FakeEmailSender`) that implement the interface.
- Fakes live in `src/test/java` alongside the tests that use them. Promote to `src/main/java` only when a dev/demo profile needs them.
- Mockito is the fallback, not the default.

### Assertions

AssertJ everywhere. `assertThat(...)`.

### Test naming

`methodUnderTest_condition_expectedOutcome`. Example: `findById_whenMissing_returnsEmpty`.

### Test data builders

Test data builders, not object mothers, not inline construction:

```java
var player = aPlayer().withTeam(patriots()).withPosition(QB).build();
```

Builders live next to the domain record they build, in `src/test/java`.

### Playwright E2E

- Critical user journeys only: signup, start a sim, view results. Not every error path.
- Runs against a booted app with Testcontainers Postgres.

---

## Logging

- SLF4J, structured output via the logstash encoder (already on the classpath).
- **Parameterized logging always.** `log.info("Player {} joined team {}", playerId, teamId)`. Never string concatenation. Never `.formatted()` inside log calls — SLF4J's lazy interpolation is the point.
- **MDC filter** (`OncePerRequestFilter`) adds `requestId`, `userId`, `sessionId` to every log line. Cleared in `finally`.
- **Log levels:**
  - `DEBUG` — be liberal. Method entry, intermediate state, branch decisions. Prod doesn't run DEBUG so verbosity is free.
  - `INFO` — state changes and use-case completion. Safe identifiers only.
  - `WARN` — recoverable issues, unexpected but handled.
  - `ERROR` — actionable failures, unexpected exceptions. Include stack trace.
- **Do not log `Result` objects.** They may carry PII or sensitive state. Log use-case completion as a simple "completed" with safe IDs; let the `Result` variant flow back to the caller untouched.
- Secrets, tokens, passwords, session IDs: **never logged**, at any level.
- PII (email, name, address): DEBUG only, and only when genuinely needed for diagnostics.
- Domain `Result` rejections are expected outcomes — INFO, not WARN/ERROR.

---

## Docs & comments

- **Javadoc on every public interface method.** Be liberal — document the contract: what returns mean, which `Result` variants are possible, invariants, preconditions.
- **No Javadoc on implementation methods** unless behavior is non-obvious.
- **Code comments:** default to none. Add one only when the *why* is non-obvious (hidden constraint, subtle invariant, workaround for a specific bug). Never describe *what* the code does — the names already do.
- **`TODO` / `FIXME`:** allowed only when tied to a GitHub issue — `// TODO(#42): …` or `// FIXME(#42): …`. Bare `TODO` / `FIXME` are banned.
- **README per feature package** when it aids orientation — a short note on purpose, key interfaces, and where the seams are.

---

## Git

- **Conventional commits.** `feat(roster): add practice-squad promotion`, `fix(sim): correct fumble recovery probability`, `refactor(data): extract query classes from PlayerRepository`.
- **Large PRs are fine.** One developer; splitting for its own sake adds churn.

---

## Build & tooling

Common commands:

```bash
./gradlew bootRun            # run the app
./gradlew test               # run all tests + jacoco report
./gradlew spotlessApply      # auto-format
./gradlew spotlessCheck      # verify formatting (run before declaring done)
./gradlew flywayMigrate      # apply migrations
./gradlew generateJooq       # regenerate jOOQ sources (requires DB up)
./gradlew tailwindBuild      # rebuild Tailwind CSS
docker compose up            # start Postgres + anything else
```

**Always run `./gradlew spotlessApply` after writing Java code, and `./gradlew spotlessCheck` before claiming a task done.** Formatting drift breaks the build.

---

## External resources

For simulation calibration questions (real NFL distributions, tracking-data priors), use the skills available in this environment:

- **`nflfastr` skill** — play-by-play stats via `nflreadr` (R). Completion %, YPC, 4th-down go rates, penalty counts, positional stat concentration.
- **`bigdatabowl` skill** — 10Hz player tracking data. Routes, coverages, pressure, formations, time-to-throw.

Prefer these over guessing numbers when calibrating sim models.
