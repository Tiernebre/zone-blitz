# Feature map

One-screen index of the feature packages, their public use-case interfaces, and the cross-feature seams that link them. Per-feature READMEs have the detail; this page is the "where do I start" jump table.

## Package layout

```
app.zoneblitz
├── league/              — league aggregate: create, delete, list, daily tick, phase machine
│   ├── cap/             — staff-cap breakdown page
│   ├── franchise/       — franchise list
│   ├── geography/       — pure records (City, State, Climate, MarketSize)
│   ├── hiring/          — candidate pools, interviews, offers, hires   [README]
│   ├── phase/           — LeaguePhase state machine + transition handlers [README]
│   ├── staff/           — post-hire org chart + recap views             [README]
│   └── team/            — team aggregate, CPU strategy seam, TeamProfile [README]
├── gamesimulator/       — play-level sim engine (own source set)        [README]
├── names/               — name generation (curated)
├── web/                 — cross-cutting web (HealthController)
└── config/              — Spring Security + session wiring
```

Feature READMEs:
- [`league/hiring/README.md`](../../src/main/java/app/zoneblitz/league/hiring/README.md)
- [`league/phase/README.md`](../../src/main/java/app/zoneblitz/league/phase/README.md)
- [`league/staff/README.md`](../../src/main/java/app/zoneblitz/league/staff/README.md)
- [`league/team/README.md`](../../src/main/java/app/zoneblitz/league/team/README.md)
- [`gamesimulator/README.md`](../../src/gamesimulator/java/app/zoneblitz/gamesimulator/README.md)

## Public use cases by feature

Listed as `Interface` → `impl` (all impls carry the `*UseCase` suffix per CLAUDE.md).

### `league` (root)

| Use case | Purpose |
|---|---|
| `CreateLeague` | Create a league + seed its 8 teams. |
| `DeleteLeague` | Delete league and cascade. |
| `GetLeague` | Fetch league by id. |
| `ListLeaguesForUser` | List leagues owned by a user. |
| `AdvanceDay` | Daily tick: run active phase's `CpuTeamStrategy`, call `OfferResolver`, advance day or phase. |
| `LeagueTablePage` | Paginated league-table view. |

### `league.phase`

| Use case | Purpose |
|---|---|
| `AdvancePhase` | Transaction: onExit → persist next phase (day=1) → onEntry. |

### `league.hiring`

| Use case | Purpose |
|---|---|
| `MakeOffer` / `MatchCounterOffer` / `DeclineCounterOffer` | Offer lifecycle. |
| `HireCandidate` | Finalize hire once stance is `AGREED`. |
| `StartInterview` | Tighten scouted-signal noise on a shortlisted candidate. |
| `ViewHeadCoachHiring` / `ViewHeadCoachHiringSummary` | HC hiring page + post-HC summary. |
| `ViewDirectorOfScoutingHiring` / `ViewDirectorOfScoutingHiringSummary` | DoS equivalents. |

### `league.staff`

| Use case | Purpose |
|---|---|
| `ViewCoachingStaffOrgChart` | Viewer's franchise org chart (coaching + scouting trees). |
| `ViewStaffRecap` | League-wide `ASSEMBLING_STAFF` recap. |

### `league.cap` / `league.franchise`

| Use case | Purpose |
|---|---|
| `ViewStaffCap` | Staff-cap breakdown page. |
| `ListFranchises` | Franchise list. |

### `gamesimulator`

| Use case | Purpose |
|---|---|
| `SimulateGame` | Simulate one game → deterministic `PlayEvent` stream from seeded `RandomSource`. |

## Cross-feature seams

The one table that answers "what can feature X call in feature Y?" Anything not in this table is a feature-internal seam (repositories, scoring helpers, generators) and is off-limits across features — enforced by ArchUnit where possible. To expose a new cross-feature seam, add it at the target feature's package root and cite it here.

| Consumer | Target feature | Seam | What it does |
|---|---|---|---|
| `league.AdvanceDayUseCase` | `hiring` | `OfferResolver` | Per-day offer tick (resolve pending, emit counters, expire). |
| `league.AdvanceDayUseCase` | `team` | `CpuTeamStrategy` (phase-keyed `Map`) | Per-day CPU action per CPU team. |
| `league.phase.HiringHeadCoachTransitionHandler` | `hiring` | `GenerateCandidatePool` | Idempotent pool generation on phase entry. |
| `league.phase.HiringDirectorOfScoutingTransitionHandler` | `hiring` | `GenerateCandidatePool` | Same for DoS phase. |
| `league.phase.HiringAssemblingStaffTransitionHandler` | `hiring` | `AssembleStaff` | Programmatic subordinate-staff assembly on ASSEMBLING_STAFF entry. |
| `league.phase.*TransitionHandler` | `phase` (own) | `HiringPhaseAutofill` | Best-fit assignment when hiring phase hits day cap unresolved. |
| `league.staff.ViewStaffRecapUseCase` | `hiring` | `FindCandidate` | Look up hired candidate by id for display. |
| `league.staff.ViewCoachingStaffOrgChartUseCase` | `hiring` | `FindCandidate` | Same. |
| `league.hiring.HiringBeans` (wiring) | `team` | `TeamProfiles` | Preference scoring uses team profile (city/franchise-sourced). |
| `league` (any) | `gamesimulator` | `SimulateGame` | Simulate a scheduled game. (Sim has no reverse dep — enforced by source-set layout.) |
| `league` (any) | `shared/rng` | `RandomSource` | The only sanctioned source of randomness. Non-sim production code must not touch `java.util.Random` / `ThreadLocalRandom` / `Math.random` (ArchUnit). |

## Dependency direction (one-line rules)

- `gamesimulator` depends on **nothing** in `app.zoneblitz.*` except its own source set. Any import from `league.*` is a bug.
- `league.*` sub-features may depend on `league` root records + other `league.*` features' **public APIs only** (package root).
- `league.hiring` sub-packages (`candidates/`, `generation/`, `interview/`, `offer/`, `hire/`, `view/`) are feature-internal — enforced by `hiringInternals_areNotImportedByOtherPackages` in `ArchitectureTests`.
- `web/`, `config/` are leaves; nothing depends on them.
- Generated jOOQ (`app.zoneblitz.jooq.*`) may only be referenced by classes whose simple name starts with `Jooq` — enforced by ArchUnit.

## Live guards

Mechanical rules (ArchUnit) in [`src/test/java/app/zoneblitz/architecture/ArchitectureTests.java`](../../src/test/java/app/zoneblitz/architecture/ArchitectureTests.java):

- `productionCode_doesNotUseUnseededRandom` — no `java.util.Random`.
- `productionCode_doesNotUseThreadLocalRandom` — no `ThreadLocalRandom`.
- `productionCode_doesNotCallMathRandom` — no `Math.random()`.
- `splittableRandom_isConfinedToRngPackage` — only `gamesimulator.rng` may touch `SplittableRandom`.
- `controllers_doNotImportGeneratedJooqPackage` — controllers never reference persistence types.
- `generatedJooq_isOnlyImportedByJooqPrefixedClasses` — jOOQ-generated types stay inside the `Jooq*` adapter layer.
- `hiringInternals_areNotImportedByOtherPackages` — cross-feature access to hiring must go through its public seams.
- `productionFiles_stayUnderLineCountCeiling` — 550 LOC cap (target 500; temporary buffer while `GameSimulator.java` is split — see [`agent-friendliness-audit.md`](agent-friendliness-audit.md)).
- `testMethods_followUnderscoreNamingConvention` — `@Test` / `@ParameterizedTest` / `@RepeatedTest` method names must contain at least one underscore.

When adding a new cross-feature constraint, add both a row to the seams table above and (if mechanizable) an ArchUnit rule to `ArchitectureTests`.
