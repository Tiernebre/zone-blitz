# 0035 — Scouting advocacy and dissent event model

- **Date:** 2026-04-16
- **Status:** Proposed
- **Area:** [Scouting](../north-star/scouting.md),
  [0034 — Genesis draft scouting phase](./0034-genesis-draft-scouting-phase.md)

## Context

ADR 0034 established the `GENESIS_DRAFT_SCOUTING` phase and named "advocacy and
dissent between scouts" as the core gameplay loop — but deferred the event model
itself. The scouting north-star describes reports landing in the GM's inbox,
scouts championing "their guys," cross-checkers pushing back, and media mocks
landing in the middle of the phase; all of these beats need a uniform data shape
so the inbox UI, the draft board decision log (0037), the director's consensus
(0038), and retrospective tools can consume the same primitives.

Without a shared event model, each surface will invent its own structure. Worse,
dissent loses its linkage to the report it dissents from, and the decision log
can't reference the moment that motivated a tier change.

## Decision

Model every scouting occurrence during the phase as an immutable row in a single
`scouting_events` log with a typed `event_kind` discriminator and a polymorphic
payload. The GM inbox, the decision log, and the director's consensus are all
projections over this log.

### Event kinds

Seven kinds cover the phase's activity:

1. **`report_published`** — A scout published a report at a depth level
   (`quick_look`, `standard`, `deep`). Payload: grade vector, confidence,
   strength/weakness tags, flavor text.
2. **`advocacy`** — A scout explicitly champions a prospect above their own
   grade ("I don't care what the tape says, I've been in his living room").
   Emitted autonomously by scouts with high conviction traits.
3. **`dissent`** — A scout pushes back against another scout's grade. Requires
   `target_event_id` referencing the report being contested.
4. **`cross_check_requested`** — The GM requested a second opinion on a prospect
   (spending an allowance from ADR 0036).
5. **`cross_check_resolved`** — A cross-checker published their second opinion.
   References the originating `cross_check_requested` event.
6. **`media_mock_published`** — A media analyst published a mock draft. Payload
   is the full first-round projection.
7. **`director_consensus_update`** — The director's consensus board shifted (new
   tier placement, new rank). Payload is the delta, not the full board.

### Authority rules

- Scouts emit `report_published`, `advocacy`, `dissent`, and (as cross-checkers)
  `cross_check_resolved` **autonomously**, driven by their hidden attributes.
  The GM cannot generate these events.
- The GM emits only `cross_check_requested`.
- Media and the director emit their own kinds on the phase's internal clock.
- All events carry a `scout_id` (or `analyst_id` / `director_id`) so authorship
  is explicit and auditable.

### GM responses are a separate surface

The GM does not mutate events. Instead, the GM's reactions live in a companion
`scouting_event_responses` table: `(event_id, response,
created_at)` where
`response` is one of `acknowledge`, `agree`, `disagree`, `defer`. Responses feed
the draft board's decision log (ADR 0037) — when the GM moves a prospect up a
tier in response to a piece of advocacy, the decision-log entry carries the
`event_id` so the "why" is preserved.

### Append-only, even for corrections

Scouts changing their minds produce **new** events (a second `report_
published`
or a self-dissent), not mutations of prior ones. The log is a historical record;
later retrospective tools depend on being able to reconstruct what was known
when.

### NPC behavior

NPC franchises auto-acknowledge all events addressed to them and rely on their
director's consensus board at lock time. NPC scouts still emit advocacy and
dissent — the events are generated league-wide regardless of which franchise
employs the scout. (Full NPC scouting behavior is its own downstream ADR.)

## Alternatives considered

- **Single flat "opinion" table with booleans.** One table with `is_dissent`,
  `is_advocacy` flags. Rejected: can't cleanly express `target_event_id` for
  dissent, doesn't accommodate media mocks or director updates, and every new
  event type forces a schema change.
- **Embed advocacy/dissent as JSON arrays on the report row.** Rejected: events
  can't be queried independently; media mocks and director consensus updates
  don't belong on a report; retrospective tools can't diff the event stream over
  time.
- **Skip dissent entirely; only report grades.** Rejected — dissent is the most
  distinctive beat of the phase and is load-bearing for the "judgment call on
  the people you hired" feel ADR 0034 commits to.
- **Event sourcing with projection tables rebuilt from the log on every read.**
  Rejected as overkill for v1. The log is append-only and the inbox is a simple
  filter over it; projections can be added later if performance demands.

## Consequences

- **One event log drives multiple surfaces.** The inbox, the decision log, the
  director's consensus, the mock-draft history, and the post-draft retrospective
  tools all read from `scouting_events`. No per-surface denormalization.
- **Scout attributes have a direct observable effect.** Advocacy and dissent
  emission rates, conviction levels, and cross-check agreement patterns all flow
  from hidden scout attributes — the Phase 3 hiring decisions from ADR 0032 now
  produce visible, measurable output.
- **Log is append-only.** Amendments are new events. This simplifies concurrency
  (no row-level locks on opinions), produces a clean audit trail, and matches
  how real scouting departments operate.
- **Enables NPC behavior and flavor text.** Downstream ADRs (NPC scouting AI,
  ADR 0039 flavor text) consume the same event stream without special- casing.
- **Follow-up work:**
  - Define the per-kind payload schemas and a migration for `scouting_events`
    and `scouting_event_responses`.
  - Wire advocacy and dissent emission to the phase step-advance hook so events
    land at the right weekly beat.
  - Implement the inbox projection and the GM response action surface.
  - Draft the NPC scouting behavior ADR (how NPC scouts choose when to advocate
    and dissent based on hidden attributes).

## Related decisions

- [0014 — Season calendar and phase state machine](./0014-season-calendar-phase-state-machine.md)
- [0018 — Genesis phase state machine](./0018-genesis-phase-state-machine.md)
- [0032 — Multi-week staff hiring process](./0032-multi-week-staff-hiring.md)
- [0034 — Genesis draft scouting phase](./0034-genesis-draft-scouting-phase.md)
