# League phases — design

Context handoff for future sessions. Covers the phase state machine that drives the league dashboard from creation through the start of the inaugural draft. Out of scope here: draft, season, offseason phases (tracked when built).

If code and this doc disagree, read the code and update the doc. If the charter and this doc disagree, the charter wins.

---

## Model

A league has one `LeaguePhase` at a time. Progression is **lockstep across all franchises** in the league — the phase is a league-level state, not per-franchise.

Within a phase, a league has a **week counter** (`phaseWeek`, 1-indexed). Each phase defines a fixed `maxWeeks`. Week advance is user-triggered from the dashboard.

Inside a phase, each franchise has its own sub-state (e.g. `HiringStep` during a hiring phase). Sub-state is per-franchise, not per-league.

---

## Phases (v1 scope)

| Phase | Purpose | User actions | Programmatic actions |
|---|---|---|---|
| `INITIAL_SETUP` | Landing after league creation. Dashboard intro. | Advance to start hiring. | None. |
| `HIRING_HEAD_COACH` | Each franchise hires a Head Coach. | View pool, interview, negotiate, accept. Advance week. | CPU franchises run same loop. Autofill on week cap. |
| `HIRING_DIRECTOR_OF_SCOUTING` | Same flow, DoS role. | Same as above. | Same as above. |
| `ASSEMBLING_STAFF` | HC hires coordinators; DoS hires scouts. Programmatic for v1. | View recap of reports hired league-wide. Advance. | HC picks coordinators; DoS picks scouts. One tick, then phase completes. |

Next phase after `ASSEMBLING_STAFF` is TBD (inaugural draft prep). Not in this doc.

### Charter reconciliation

Charter [`docs/product/north-star/charter.md`](../product/north-star/charter.md) line 45 describes HC/DoS returning a shortlist for the user to pick from. **v1 ships programmatic** (HC/DoS picks directly). Shortlist mechanic is future work. Update the charter when shortlist lands.

---

## Hiring sub-state machine

Shared between `HIRING_HEAD_COACH` and `HIRING_DIRECTOR_OF_SCOUTING`. Each franchise holds its own `HiringStep`:

```
VIEWING_POOL → INTERVIEWING → NEGOTIATING → HIRED
```

- `VIEWING_POOL` — franchise browses the league-wide candidate pool. Can shortlist candidates.
- `INTERVIEWING` — franchise is interviewing a shortlisted candidate. Interview reveals hidden attributes with noise (see [`busts-and-gems.md`](../product/north-star/busts-and-gems.md)). Multiple interviews per week allowed, bounded by capacity (TBD — default 3/week).
- `NEGOTIATING` — franchise has made an offer to one candidate. Candidate accepts, counters, or walks.
- `HIRED` — terminal for the phase. Franchise waits for remaining teams or week cap.

A candidate in `NEGOTIATING` with one franchise is unavailable to others (locked for the duration of the negotiation round — one week).

Phase ends when either:
- All franchises reach `HIRED`, or
- `phaseWeek > maxWeeks` — any franchise not at `HIRED` gets an auto-assigned hire from the remaining pool.

`maxWeeks` defaults: `HIRING_HEAD_COACH = 3`, `HIRING_DIRECTOR_OF_SCOUTING = 3`, `ASSEMBLING_STAFF = 1`.

---

## Candidate pool

League-wide, shared across all franchises. Generated at phase entry; drives the scarcity economy ([`scarcity-economy.md`](../product/north-star/scarcity-economy.md)).

- Generated per phase entry from `data/bands/` (distributions TBD — coach market bands not yet authored; gap tracked against sim-engine doc).
- Candidates have hidden true attributes; franchises see only scouted signal.
- Pool size: 2–3× franchise count for HC/DoS phases.
- A candidate hired by any franchise is removed from the pool immediately.

---

## Ticks

A **tick** is any event that advances league state. Two kinds:

| Tick | Trigger | Scope |
|---|---|---|
| User action tick | User submits an action (start interview, make offer, hire) | User's franchise only. Pool updates (e.g. lock candidate in negotiation) are immediate and visible to CPU teams on the next week tick. |
| Week tick | User clicks "advance week" | Every CPU franchise executes one week of decisions via its `CpuFranchiseStrategy`. `phaseWeek` increments. Phase-completion check runs after. |

Phase transitions run as part of the week tick that satisfies completion. Transition hooks generate the next phase's candidate pool (if any) and reset per-franchise sub-state.

---

## Seams (interfaces)

Package-private inside the feature package unless cross-feature consumers appear. Constructor-injected. No concrete types in consumer code (ITDD).

| Interface | Responsibility |
|---|---|
| `AdvanceWeek` | Use case: run a week tick. Drives CPU strategies, increments `phaseWeek`, runs phase-completion check. |
| `AdvancePhase` | Use case: transition to next phase. Runs entry hooks (pool generation, sub-state reset). Called by `AdvanceWeek` on completion. |
| `CandidatePool` | Stores candidates per league per phase. Generated on phase entry, mutated as candidates are hired or locked. |
| `CandidateGenerator` | Generates a candidate pool for a given phase from band data. One implementation per candidate type (`HeadCoachGenerator`, `DirectorOfScoutingGenerator`). |
| `CpuFranchiseStrategy` | Per-phase CPU decision-maker. One implementation per phase (`CpuHiringStrategy` for both HC/DoS phases; `CpuStaffAssemblyStrategy` for `ASSEMBLING_STAFF`). Given league + franchise state, returns actions to apply. |
| `PhaseTransitionHandler` | Runs on phase entry/exit. One per phase. Creates candidate pool on entry, resolves unfilled hires (autofill) on exit. |
| `HiringRepository` | Per-franchise `HiringStep`, shortlist, active interview, active negotiation. |
| `CandidatePoolRepository` | Persistence for candidate pools and lock state. |

Feature-internal. Cross-feature access (e.g. from the future draft feature) goes through public use cases like `GetCurrentPhase`, not these seams directly.

---

## Persistence

### Schema additions

- `league.phase_week INT NOT NULL DEFAULT 1` — current week within the phase.
- `league_phase_max_weeks` — config table or constants; start with constants in code, move to DB when configurable.
- `candidate_pool` — `(id, league_id, phase, candidate_type, generated_at)`.
- `candidate` — `(id, pool_id, kind, hidden_attrs JSONB, scouted_attrs JSONB, hired_by_franchise_id NULL, locked_by_franchise_id NULL, locked_until_week NULL)`.
- `franchise_hiring_state` — `(franchise_id, phase, step, shortlist JSONB, interviewing_candidate_id NULL, negotiating_candidate_id NULL)`.
- `franchise_staff` — `(id, franchise_id, role, candidate_id, hired_at_phase, hired_at_week)` — terminal hires. Role enum includes HEAD_COACH, DIRECTOR_OF_SCOUTING, OFFENSIVE_COORDINATOR, DEFENSIVE_COORDINATOR, SCOUT, etc.

Flyway migrations per logical change. Never edit applied migrations.

### Transactions

`@Transactional` on the use case (`AdvanceWeek`, `AdvancePhase`, individual user actions like `StartInterview`, `MakeOffer`). A week tick is one transaction — all CPU decisions commit or roll back together.

---

## Web layer

Per-phase dashboard views, composed from HTMX fragments. Separate URLs for full pages vs fragments per project convention.

| Phase | Page | Fragments |
|---|---|---|
| `INITIAL_SETUP` | `/leagues/{id}` (dashboard) | Intro card, `POST /leagues/{id}/phase/advance`. |
| `HIRING_HEAD_COACH` / `HIRING_DIRECTOR_OF_SCOUTING` | `/leagues/{id}/hiring/{role}` | Candidate pool table, shortlist panel, active interview card, active negotiation card, week counter, `POST /leagues/{id}/week/advance`. |
| `ASSEMBLING_STAFF` | `/leagues/{id}/staff-recap` | League-wide staff hire recap, `POST /leagues/{id}/phase/advance`. |

Dashboard (`/leagues/{id}`) is the default landing; it redirects or composes the active phase's view based on `league.phase`.

No JSON endpoints from web controllers. Fragment responses are `text/html`.

---

## Testing

- `@JooqTest` with Testcontainers for all repository + use-case tests. No `InMemoryCandidatePoolRepository` etc.
- Per CLAUDE.md: DB-touching tests always use real Postgres.
- `FakeRandomSource` for candidate generation determinism.
- `FakeClock` where timestamps matter.
- CPU strategies tested as interface implementations with deterministic inputs.
- Playwright E2E: one happy-path journey through `INITIAL_SETUP → HIRING_HEAD_COACH → HIRING_DIRECTOR_OF_SCOUTING → ASSEMBLING_STAFF`.

---

## Open items

- Interview capacity per week (default 3, tune later).
- Coach market band data — `data/bands/` does not yet have coach/scout distributions. Placeholder generators until authored.
- `ASSEMBLING_STAFF` recap UX detail — which staff roles are hired by HC vs. DoS, and exact roster.
- Week cap values (`maxWeeks`) — current defaults are guesses; tune against playtest.
- Autofill logic — pick best remaining candidate vs. random from remaining; needs decision.
