# 0018 — Genesis phase state machine

- **Date:** 2026-04-15
- **Status:** Proposed
- **Area:** [League Genesis](../north-star/league-genesis.md),
  [League Management](../north-star/league-management.md),
  [0014 — Season calendar and phase state machine](./0014-season-calendar-phase-state-machine.md)

## Context

ADR 0017 ratifies League Genesis as the canonical creation flow. Genesis
introduces a one-shot sequence of setup phases — league charter, franchise
establishment, staff hiring, founding player pool, allocation draft, free
agency, kickoff — that doesn't exist in subsequent offseasons.

ADR 0014 defines the recurring season-calendar state machine as an ordered phase
enum + per-phase step catalog on a single `league_clock` row, with
user-initiated advance and gated transitions. Genesis requires distinct entry
phases that run exactly once, before any recurring calendar starts. Without a
ratified extension, implementations will either hack genesis into the recurring
offseason (conceptually wrong) or build a parallel state machine (duplicated
logic, drift risk).

## Decision

**Extend ADR 0014's phase enum with a one-shot genesis phase sequence that runs
exactly once per league, before the first preseason/regular-season cycle.** The
genesis phases — `GENESIS_CHARTER`, `GENESIS_FRANCHISE_ESTABLISHMENT`,
`GENESIS_STAFF_HIRING`, `GENESIS_FOUNDING_POOL`, `GENESIS_ALLOCATION_DRAFT`,
`GENESIS_FREE_AGENCY`, `GENESIS_KICKOFF` — share the same `league_clock` row and
the same user-initiated-advance / gated-transition rules as recurring phases. A
`has_completed_genesis` (or equivalent) flag on the clock row prevents the
genesis phases from re-entering after the first transition into Year 2.

## Alternatives considered

- **Separate `genesis_clock` table/state machine.** Cleanly isolates one- shot
  phases from recurring ones. Rejected because it duplicates advance logic,
  ready-check enforcement, and UI components; any future change to advance rules
  has to be made twice.
- **Fold genesis steps into the recurring offseason as special first-year
  branches.** Reuses the recurring state machine. Rejected because the phases
  are semantically different (charter and franchise establishment have no analog
  in Year 2+) and the branching logic would bloat every recurring phase.
- **Treat genesis as out-of-band pre-league setup (no clock row until Year 1
  kickoff).** Simple, but loses the shared advance/ready-check mechanics that
  multiplayer genesis needs. A league being founded collectively by eight human
  owner/GMs is exactly the kind of gated multi-step process the clock state
  machine was built for.

## Consequences

- **Makes easier:** one advance mechanism, one ready-check mechanism, one
  transition API used uniformly across genesis and recurring phases. UI for
  "ready up" on a genesis step works the same as for a regular-season week.
- **Makes easier:** testing — genesis can be driven by the same phase-advance
  test harness ADR 0014 establishes.
- **Makes harder:** phase enum grows (seven additional values) and each new
  genesis phase needs its own step catalog. Worth it for the uniformity.
- **Follow-up work:**
  - Implement the genesis phases against ADR 0014's `league_clock` schema;
    extend the phase enum migration
  - Define the step catalog for each genesis phase (what counts as "done" before
    the phase can advance — e.g., all franchises established, all staff hired,
    allocation draft complete)
  - Wire the `has_completed_genesis` guard into the phase-advance handler so
    Year 2+ can never re-enter a genesis phase
  - Seed existing established-mode leagues (if any are created) with a
    post-genesis clock state to skip the sequence cleanly
