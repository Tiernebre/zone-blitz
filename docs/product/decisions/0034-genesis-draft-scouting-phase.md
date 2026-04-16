# 0034 — Genesis draft scouting phase

- **Date:** 2026-04-16
- **Status:** Accepted
- **Area:** [Scouting](../north-star/scouting.md),
  [League Genesis](../north-star/league-genesis.md),
  [0014 — Season calendar and phase state machine](./0014-season-calendar-phase-state-machine.md),
  [0018 — Genesis phase state machine](./0018-genesis-phase-state-machine.md),
  [0032 — Multi-week staff hiring process](./0032-multi-week-staff-hiring.md)

## Context

ADR 0018 established the genesis phase sequence: charter → franchise
establishment → staff hiring → founding player pool → allocation draft → free
agency → kickoff. The scouting north-star specifies that "the first evaluation
work your scouts do is on the veteran pool heading into the allocation draft,"
but no phase in the current sequence makes space for that evaluation to happen.
Today the founding pool is generated and then immediately drafted — with no
window for the staff hired in Phase 3 to produce reports, for the GM to build a
draft board, or for advocacy and dissent between scouts to play out.

This collapses the entire scouting north-star into a one-click transition. It
also prevents the Phase 3 hiring decisions from paying off — you hired a staff,
but they never produce any work before the first pick is made.

## Decision

Insert a new phase `GENESIS_DRAFT_SCOUTING` between `GENESIS_FOUNDING_POOL` and
`GENESIS_ALLOCATION_DRAFT`. The phase runs across **four simulated weeks**, each
modeled as a step in ADR 0014's phase-step catalog. Each week represents a
distinct beat of the pre-draft scouting window.

### Phase placement

Updated genesis sequence:

1. `GENESIS_CHARTER`
2. `GENESIS_FRANCHISE_ESTABLISHMENT`
3. `GENESIS_STAFF_HIRING`
4. `GENESIS_FOUNDING_POOL`
5. **`GENESIS_DRAFT_SCOUTING`** _(new)_
6. `GENESIS_ALLOCATION_DRAFT`
7. `GENESIS_FREE_AGENCY`
8. `GENESIS_KICKOFF`

The phase enum introduced in ADR 0018 is extended with this one additional value
in the correct ordinal position.

### Step catalog

Four steps, each one simulated week:

1. **`scouting_pool_reveal` (Week 1).** The founding player pool becomes visible
   to the GM with public information only — measurables, age, archetype bio,
   last affiliation. No scout grades or opinions are present yet. Scouts begin
   autonomous evaluation work. The GM has the week to review the pool shape for
   the first time. This is the "quiet week" before reports start landing.

2. **`scouting_first_reports` (Week 2).** The first wave of staff reports lands
   — broad coverage across the pool with quick-look depth on most prospects and
   standard evaluations on a prioritized subset (prioritized by the scouting
   director, not the GM). Initial scout advocacy events begin surfacing in the
   GM's inbox. Pre-draft visits and private workouts become available to the GM.

3. **`scouting_deep_eval` (Week 3).** Deep reports land on priority prospects.
   Scouts with divergent views surface dissent events for the GM to adjudicate.
   The mid-phase media mock draft publishes. Cross-check requests can be used to
   solicit a second opinion on polarizing names.

4. **`scouting_board_lock` (Week 4).** Final reports land. Final media mocks
   publish. The scouting director's consensus board is finalized and presented
   to the GM. The GM finalizes their own draft board. Phase advances only after
   the board is locked.

### Gate condition

The phase cannot advance past `scouting_board_lock` until the franchise has
submitted a ranked draft board. An empty or unedited board is a valid submission
— the gate only requires an explicit lock action. NPC franchises auto-satisfy
the gate by accepting their director's consensus board.

### Philosophy anchor

The phase is designed around a strict rule: **the GM does not assign scouts to
prospects.** Every franchise's scouting operation is structurally identical —
same staff slots, same phase length, same league-wide allowances. Competitive
differentiation comes from _who_ was hired in Phase 3 and the quality of their
hidden attributes, not from any GM-controlled resource. The GM's role during
this phase is to read reports, adjudicate advocacy and dissent between scouts,
and build their own draft board.

This is load-bearing for the phase's feel: the scouting phase is not a
resource-management minigame, it is a series of judgment calls on the people the
GM already hired.

### Scope of this ADR

This ADR defines only the phase placement, step count, and step catalog. The
following are explicitly out of scope and will be addressed in subsequent ADRs:

- **Advocacy and dissent event model** — how scout opinions are generated,
  surfaced, recorded, and rendered. This is the core gameplay loop of the phase
  and warrants its own ADR.
- **League-wide scouting allowances** — pre-draft visit cap, cross-check request
  cap, exact numeric values and tuning rationale.
- **Draft board data model** — schema for the GM's tiered board, notes, and
  decision log linking back to advocacy/dissent events.
- **Scouting director consensus logic** — how the director aggregates staff
  reports into a unified consensus board.
- **Report generation and scout AI** — what mix of quick-look / standard / deep
  reports each staff produces per week, driven by hidden scout attributes.
- **NPC scouting behavior** — how NPC franchises operate their staff during the
  phase, invisible to the GM per the info-asymmetry rule.
- **Flavor text generation** — templated for MVP, with schema designed to swap
  in LLM-generated text later.
- **UI designs** — inbox, board builder, visits panel, director's desk.

Pinning phase placement and the step catalog first gives those downstream ADRs a
stable scaffold to hang off.

## Alternatives considered

- **Fold scouting into `GENESIS_FOUNDING_POOL`.** Extend the founding pool
  phase's step catalog to include scouting beats. Rejected because it conflates
  two semantically distinct activities — generating the pool and evaluating the
  pool — and makes the founding-pool phase disproportionately long. Keeping them
  separate produces cleaner phase boundaries and makes the scouting window a
  real, named interval in the league's history.

- **Fold scouting into `GENESIS_ALLOCATION_DRAFT`.** Run scouting as pre-draft
  steps within the allocation draft phase. Rejected for the same clarity reason
  — the allocation draft phase should be about executing the draft, not
  preparing for it.

- **Single-step scouting phase (no weekly breakdown).** Insert
  `GENESIS_DRAFT_SCOUTING` but collapse it to one step. Rejected because it
  eliminates the report-arrival cadence that makes reports feel like something
  happening over time rather than a data dump. The multi-week pacing mirrors ADR
  0032's decision for staff hiring and gives the GM multiple decision cycles.

- **More than four weeks (e.g., 6 or 8).** Rejected for MVP because the
  mature-league scouting beats that justify more weeks (college season, Senior
  Bowl, combine, pro days) do not exist in genesis. The founding pool is static
  and the evaluation window is naturally compressed. Four weeks is sufficient to
  pace report arrival without inflating phase length. Can be tuned via league
  settings after MVP proves the cadence.

- **Variable phase length as a league setting.** Rejected for v1 to keep the
  step catalog fixed. Exposing the step count as a league parameter is
  straightforward to add after the MVP ships.

- **GM-directed scout assignments (reject by design).** An earlier draft of the
  model considered a "scouting points" budget the GM spent across prospects.
  Rejected explicitly: it creates a resource-management game where teams
  differentiate by spending more, which breaks the competitive-parity principle
  and does not reflect how real NFL GMs operate. Documented here to prevent the
  design from regressing.

## Consequences

- **The phase enum migration from ADR 0018 must be extended.** One new value
  (`GENESIS_DRAFT_SCOUTING`) inserted between `GENESIS_FOUNDING_POOL` and
  `GENESIS_ALLOCATION_DRAFT`. All phase ordering logic that enumerates genesis
  phases must include it.

- **The phase-step catalog must be seeded with four rows.** Slugs:
  `scouting_pool_reveal`, `scouting_first_reports`, `scouting_deep_eval`,
  `scouting_board_lock`. This matches the seeding pattern ADR 0032 used for
  hiring.

- **Staff hired in Phase 3 now has meaningful work to produce.** The Phase 3
  hiring decisions pay off in this phase through report quality, advocacy
  strength, and consensus-board accuracy — even though those mechanisms are
  defined in downstream ADRs. Without this phase, Phase 3 has no observable
  consequences before the draft.

- **The allocation draft phase can assume a draft board exists.** Any
  draft-order or pick-selection logic built against `GENESIS_ALLOCATION_DRAFT`
  can assume every franchise has a locked board from the preceding phase, and
  can fall back to the director's consensus for franchises that didn't customize
  it.

- **The scouting north-star can be read literally.** Today the north-star
  describes scouting beats (report arrival, advocacy, dissent, cross- checks,
  mocks) that have no home in the state machine. This ADR gives them a home.

- **Follow-up work:**
  - Extend the phase enum migration with `GENESIS_DRAFT_SCOUTING` in the correct
    ordinal position.
  - Seed `league_phase_step` rows for the new phase with the four-step catalog.
  - Implement the phase-advance handler and board-lock gate function.
  - Draft the next ADR: advocacy and dissent event model (the core gameplay loop
    of the phase).
  - Draft the ADR: league-wide scouting allowances (pre-draft visits,
    cross-check requests).
  - Draft the ADR: draft board data model.
  - Draft the ADR: scouting director consensus logic.
  - Draft the ADR: flavor text generation strategy (templated for MVP, schema
    design for LLM swap later).

## Related decisions

- [0014 — Season calendar and phase state machine](./0014-season-calendar-phase-state-machine.md)
- [0018 — Genesis phase state machine](./0018-genesis-phase-state-machine.md)
- [0024 — Allocation draft as Year 1's only draft](./0024-allocation-draft-as-year-one-only-draft.md)
- [0032 — Multi-week staff hiring process](./0032-multi-week-staff-hiring.md)
