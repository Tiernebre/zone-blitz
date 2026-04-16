# 0037 — Draft board data model

- **Date:** 2026-04-16
- **Status:** Proposed
- **Area:** [Scouting](../north-star/scouting.md),
  [Drafting](../north-star/drafting.md),
  [0034 — Genesis draft scouting phase](./0034-genesis-draft-scouting-phase.md),
  [0035 — Scouting advocacy and dissent event model](./0035-scouting-advocacy-dissent-event-model.md)

## Context

ADR 0034 gates `scouting_board_lock` on "the franchise has submitted a ranked
draft board." ADR 0035 emits a stream of scouting events the GM has been
reacting to across the four-week phase. The allocation draft phase (ADR 0024)
expects a locked board to exist when it begins. None of these commitments is
executable without a data model for the board itself — how entries are ranked,
how tiers are expressed, how GM notes attach, and how the "why" of each
placement links back to the events that motivated it.

A flat ranked list would technically satisfy the gate but would miss two things
the scouting north-star calls load-bearing: tier groupings (which are how real
GMs actually think about draft boards — boundaries matter more than exact
ranking within a tier) and a decision log (which is the connective tissue
between the scouting phase and the post-draft retrospective tools).

## Decision

Introduce four tables that together model the franchise's draft board, scoped to
a specific draft (`draft_id`):

### `draft_boards`

One row per franchise per draft. Fields: `franchise_id`, `draft_id`, `source`
(`'gm'` or `'director_consensus'`), `locked_at` (nullable),
`inherited_from_consensus_at` (nullable — set when an unedited board is
auto-seeded from the director at lock time).

### `draft_board_tiers`

Ordered list of tiers per board. Fields: `board_id`, `sort_order`, `label`
(e.g., "Round 1 talent", "Developmental", "Avoid"). Tiers are free-form within a
board — a GM can have 3 tiers or 12. The director's consensus board seeds a
default tier layout that the GM can restructure.

### `draft_board_entries`

One row per prospect placed on the board. Fields: `board_id`, `tier_id`,
`rank_within_tier` (explicit integer; no implicit ordering), `prospect_id`.
Every prospect in the founding pool must appear on every franchise's board by
the `scouting_board_lock` step — the gate validates exhaustive coverage, not
just non-emptiness.

### `draft_board_decisions`

Append-only log of every mutation to the board. Fields: `board_id`, `action`
(`'place'`, `'move'`, `'remove'`, `'tier_rename'`, `'tier_add'`,
`'tier_remove'`, `'note_edit'`), `from_tier_id` / `to_tier_id` (nullable),
`from_rank` / `to_rank` (nullable), `prospect_id` (nullable), `reason_event_id`
(nullable, references `scouting_events` from ADR 0035), `note` (optional GM free
text), `created_at`.

The `reason_event_id` is the critical link: when the GM moves a prospect up a
tier after a piece of advocacy lands in the inbox, the decision log captures
which event motivated the move. This is what makes retrospective review possible
in years 2+ ("I bumped him up because my ACC scout advocated — was that signal
worth trusting?").

### Notes

GM free-text notes attach to entries via an optional `note` column on
`draft_board_entries` (single latest note) and a full history via
`action = 'note_edit'` decision-log entries. This keeps the hot path (rendering
the board) simple while preserving history.

### Lock semantics

"Lock" is an explicit GM action that sets `locked_at`. A board cannot be locked
if any founding-pool prospect is missing from it (gate rejects with a list of
unplaced prospects). After lock:

- Tiers and entries are frozen.
- The decision log accepts no further entries.
- The allocation draft phase reads entries sorted by
  `(sort_order,
  rank_within_tier)` to drive the pick queue.

### Consensus pre-seed

A GM who never touches their own board inherits the director's consensus board
at Week 4 end via an atomic copy — a new `draft_boards` row with
`source = 'gm'`, `inherited_from_consensus_at = now()`, tiers and entries
duplicated from the consensus. This preserves per-franchise isolation (the
director's consensus is shared reference data; the GM's board is their own). NPC
franchises always use the same inheritance path at lock.

### Invariants

- Every prospect in the founding pool appears on every franchise's board exactly
  once by lock time.
- A prospect cannot appear in more than one tier on the same board.
- `rank_within_tier` is unique per `(board_id, tier_id)`.
- Decision-log entries are append-only; no updates, no deletes.

## Alternatives considered

- **Flat ranked list (no tiers).** A single `board_id`, `prospect_id`, `rank`
  table. Simpler schema. Rejected: collapses the tier boundary semantics that
  real NFL front offices rely on and that the scouting north-star references
  throughout. Exact within-tier ordering is lower- signal than tier placement,
  and conflating them makes the board less expressive.
- **No decision log.** Retrospective tools compute "why" from timestamp
  proximity between scouting events and board changes. Rejected: the heuristic
  is fragile (events cluster, multi-prospect moves ambiguous) and the
  retrospective tools — a core value driver from the scouting north-star — would
  be guessing where they should be reading.
- **Board is a derived projection over events.** Events like
  `gm_placed_prospect` produce the board on read. Rejected: the GM's ranking is
  a first-class authored artifact, not a reaction log. Mixing
  derived-from-events with authored-by-GM blurs authorship in ways that make the
  decision log harder to reason about.
- **Shared board table across all drafts (current + future).** Skip the
  `draft_id` scope. Rejected: multi-draft leagues (Year 2+) need clean
  isolation; scoping to `draft_id` from day one avoids a migration later.

## Consequences

- **Allocation draft has a stable input contract.** ADR 0024's pick logic reads
  locked boards via a single projection, with a clean fallback path for
  franchises that inherited consensus.
- **Retrospective tools have data to work with.** The decision log is the
  substrate for the "draft class report card" and the scout-accuracy meta-game
  the north-star describes. Without it, those tools cannot distinguish a pick
  driven by scout advocacy from a pick driven by GM hunch.
- **Director's consensus (ADR 0038) has a write target.** Consensus updates
  write to the same tables, marked `source = 'director_consensus'`. Humans and
  the director share one schema.
- **Board operations are durable and auditable.** Append-only decisions mean the
  board history survives forever — a multi-year league can see how a GM's board
  philosophy evolved.
- **Follow-up work:**
  - Drizzle schema for the four tables; indexes on `(board_id, tier_id)` and
    `(board_id, prospect_id)`.
  - Board-lock gate function used by ADR 0034's `scouting_board_lock` step.
  - Consensus inheritance action (copy-on-lock for unedited boards).
  - Allocation-draft reader that serializes a locked board into a pick queue.

## Related decisions

- [0024 — Allocation draft as Year 1's only draft](./0024-allocation-draft-as-year-one-only-draft.md)
- [0034 — Genesis draft scouting phase](./0034-genesis-draft-scouting-phase.md)
- [0035 — Scouting advocacy and dissent event model](./0035-scouting-advocacy-dissent-event-model.md)
