# Phase

League phase state machine. Owns the `LeaguePhase` enum, the per-phase ordering and day caps, and the `PhaseTransitionHandler` seam that phase-specific entry/exit logic plugs into. The `AdvancePhase` use case runs the outgoing phase's `onExit`, persists the new phase with `phase_day = 1`, and runs the incoming phase's `onEntry` — all inside a single transaction.

## Public API

### Use cases

- `AdvancePhase` — advance a league from its current phase to the next phase. Returns `AdvancePhaseResult`.

### Seams

- `PhaseTransitionHandler` — per-phase entry/exit hook. One implementation per `LeaguePhase` that owns lifecycle state. Handlers are `@Component`s discovered by component scan; `AdvancePhaseUseCase` collects them into a `Map<LeaguePhase, PhaseTransitionHandler>` keyed by `phase()`.
- `HiringPhaseAutofill` — invoked when a hiring phase hits its day cap before every team has hired. Implementations assign a best-fit candidate to each unresolved team.

### Enums and ordering

- `LeaguePhase` — `INITIAL_SETUP`, `HIRING_HEAD_COACH`, `HIRING_DIRECTOR_OF_SCOUTING`, `EXPANSION_DRAFT_SCOUTING`, `ASSEMBLING_STAFF`, `COMPLETE`.
- `HiringStep` — per-franchise sub-state within a hiring phase: `SEARCHING`, `HIRED`.
- `LeaguePhases` — static `next(phase)` and `maxDays(phase)` lookups; single source of truth for "what comes next" and "when does the phase end by cap". Currently: HC and DoS are capped at 21 days; `ASSEMBLING_STAFF` at 1; `INITIAL_SETUP` uncapped.
- `HiringPhases` — `poolTypeFor(phase)` and `staffRoleFor(phase)` maps for the two hiring phases; `isHiring(phase)` predicate.

## Internal structure

Flat package. Concrete handlers:

- `HiringHeadCoachTransitionHandler` — on entry, generates the HC candidate pool and initializes every franchise's hiring state.
- `HiringDirectorOfScoutingTransitionHandler` — same for DoS.
- `HiringAssemblingStaffTransitionHandler` — on entry, populates subordinate staff (coordinators, position coaches, scouts) from generators; largest handler.
- `BestFitHiringAutofill` — the default `HiringPhaseAutofill`; preference-fit scoring with deterministic tie-break.
- `AdvancePhaseUseCase` — the `AdvancePhase` implementation.

## Extending

- Adding a new phase: see [`docs/playbooks/add-a-league-phase.md`](../../../../../../docs/playbooks/add-a-league-phase.md). Adding a `LeaguePhase` variant intentionally breaks every exhaustive `switch` in the codebase; fix each one rather than adding `default`.
- Adding a `PhaseTransitionHandler`: implement the interface, annotate `@Component`, keep it idempotent, use seeded RNG only. Do not extend `HiringPhases` / `LeaguePhases` with a `default` branch.

## Tests

Tests at `src/test/java/app/zoneblitz/league/phase/`.

- Handlers run under `@JooqTest` + `@Import(PostgresTestcontainer.class)`, constructed manually in `@BeforeEach` against real `Jooq*Repository` instances.
- `AdvancePhaseUseCaseTests` uses a `RecordingHandler` fake to assert `onExit` → persist → `onEntry` ordering.
- `HiringDirectorOfScoutingPhaseProgressionTests` and `StaffAssemblyE2ETest` cover full cross-phase flows.

## Design docs

- [`docs/technical/league-phases.md`](../../../../../../docs/technical/league-phases.md) — phase design, hiring sub-state machine, seams table.
- [`CLAUDE.md`](../../../../../../CLAUDE.md) — project-wide conventions.
