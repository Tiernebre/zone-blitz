# Team

The team aggregate: 8 teams per league, one user-owned plus seven CPU-controlled. Owns the team-insert path (used by league creation), the city/franchise-sourced `TeamProfile` read seam consumed by offer scoring, the per-team hiring sub-state, and the `CpuTeamStrategy` seam that drives CPU behavior on every day tick.

## Public API

### Seams

- `CpuTeamStrategy` — per-phase CPU decision-maker. One implementation per `LeaguePhase` that requires CPU behavior; `AdvanceDay` resolves the active phase's strategy and invokes `execute(leagueId, teamId, phaseDay)` once per CPU team per day tick. Implementations must be deterministic given inputs and must persist through feature repositories so side effects commit atomically with the tick.
- `TeamProfiles` — returns a `TeamProfile` for preference scoring. V1 reads static fields (market size, geography, climate) from the team's franchise city and returns equal-footing constants for dynamic fields (prestige, window, owner stability, facility quality, scheme alignment).
- `TeamLookup` — read-side: team ids in a league, CPU-only ids, and the single user team id.
- `TeamRepository` — write-side: batch-insert all teams for a league with a shared `staffBudgetCents` ceiling.
- `TeamHiringStateRepository` — upsert/find per-`(team, phase)` hiring sub-state (`SEARCHING` or `HIRED` + interviewing-candidate history).

### Shared records

- `TeamDraft` — insert-side record; empty `ownerSubject` means CPU.
- `TeamProfile` — preference-scoring snapshot (market size, geography, climate, prestige, window, owner stability, facility quality, scheme alignment).
- `TeamHiringState` — per-team hiring sub-state (`phase`, `step`, `interviewingCandidateIds`).

## Internal structure

Flat package.

- `CityTeamProfiles` — the `TeamProfiles` implementation; derives static fields from the franchise's city seed.
- `JooqTeamRepository`, `JooqTeamHiringStateRepository`, `JooqTeamLookup` — jOOQ adapters.

`CpuHiringStrategy` (the hiring-phase `CpuTeamStrategy`) lives in [`hiring/hire/`](../hiring/hire/) and is wired as two `@Bean`s in `HiringBeans` (one per hiring phase).

## Extending

- Adding a new `CpuTeamStrategy` for a new phase: implement the interface, annotate `@Component`, wire via the owning feature's `@Configuration` class (one bean per phase). Keep the strategy package-private in its owning feature.
- Adding team-profile dimensions: extend the `TeamProfile` record, fix the exhaustive switches the compiler surfaces, update `CityTeamProfiles` to populate the new field.
- Adding a read query: extend `TeamLookup`; keep `TeamRepository` insert-only.

## Tests

Tests at `src/test/java/app/zoneblitz/league/team/`.

- `JooqTeamHiringStateRepositoryTests` — `@JooqTest` + `@Import(PostgresTestcontainer.class)`.
- `TeamDraftBuilder`, `TeamHiringStateBuilder`, `TeamProfileBuilder` — test data builders.

## Design docs

- [`docs/technical/league-phases.md`](../../../../../../docs/technical/league-phases.md) — `CpuTeamStrategy` seam and tick flow.
- [`CLAUDE.md`](../../../../../../CLAUDE.md) — project-wide conventions.
