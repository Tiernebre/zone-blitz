# 0006 — Unify draft prospects and players into a single `players` entity

- **Date:** 2026-04-14
- **Status:** Accepted
- **Area:** drafting, scouting — see
  [`../north-star/drafting.md`](../north-star/drafting.md) and
  [`../north-star/scouting.md`](../north-star/scouting.md)

## Context

The current schema models draft prospects in a separate `draft_prospects` table,
distinct from `players`. A prospect becoming a pro on draft day requires
copying/promoting data between tables, which duplicates attribute and rating
shape across two entities and introduces a sync problem. It also makes career
history harder to preserve — a player's pre-draft scouting grades and draft
class live in a table the player himself is no longer in.

A prospect and an active player are the same underlying entity (an identity plus
ratings and attributes) at different stages of a single lifecycle. The only
meaningful difference is whether the player is currently draftable. That is a
state, not a type.

We also want the game to preserve a player's pre-draft evaluation _forever_, so
a user can look back at a veteran and see the scouting grades he was drafted on
— a core part of the career-arc storytelling the sim is meant to support.

## Decision

Drop the `draft_prospects` table. Model prospects and players as a single
`players` entity with:

1. A `status` column on `players` with values `prospect | active | retired`,
   enforced by a CHECK constraint (or Postgres enum). `status` represents
   current lifecycle state only.
2. A 1:1 `player_draft_profile` table, keyed by `player_id`, holding the
   **immutable** pre-draft snapshot: draft class year, pre-draft scouting
   grades, projected round, combine/scouting notes. Written at prospect
   creation, frozen once the player is drafted, never mutated thereafter.
3. A `player_season_ratings` table keyed by `(player_id, season)` capturing the
   year-over-year rating history, so the career arc is preserved without
   overwriting.

The scouting and draft pool surfaces filter by `status = 'prospect'` through a
single repository function (e.g. `findDraftEligiblePlayers`). No caller
hand-rolls the filter. Status transitions `prospect → active` happen in exactly
one service method (`draftPlayer`) that writes the draft pick record atomically
in the same transaction.

There is no separate `drafted` status — being drafted _is_ the transition event
into `active`, not a state of its own.

## Alternatives considered

- **Keep `draft_prospects` as a separate table** — rejected. Forces duplicated
  shape (ratings, attributes, scouting reports) across two entities, an
  error-prone promotion step on draft day, and awkward history: a pro's
  pre-draft profile lives in a table he no longer belongs to.
- **Unified players table, but use a lookup table (`player_statuses`) instead of
  an enum/CHECK** — rejected, but worth documenting the dissent since it's the
  more OOP-idiomatic shape. The polymorphism analogy (status-as-subtype) is
  tempting but doesn't fit here: prospects and active players have the _same_
  shape and the _same_ operations. They differ only in whether they're currently
  draftable — a state, not a type. A lookup table would add a join to every read
  on a hot path (the draft pool), without earning any behavior a CHECK
  constraint doesn't already provide. The lookup-table pattern _does_ earn its
  keep when statuses carry their own data (e.g. `retired` needs a retirement
  date; `injured_reserve` needs a return date and injury type) — but that is
  better modeled as a temporal `player_status_events` log with a discriminator,
  not a static lookup table. If we grow those needs, we add the event log
  alongside `status`, we don't retrofit a lookup table.
- **Store career ratings as a JSON blob on `players`** — rejected. Blocks
  querying ("top 10 players by overall in season 2028"), hurts indexing, and
  makes season-by-season joins awkward. A normalized `player_season_ratings`
  table is the right shape for a timeline users will slice many ways.
- **Fold the draft profile into `players` as nullable columns** — rejected. The
  pre-draft snapshot is conceptually a different thing with a different
  mutability rule (immutable post-draft). Keeping it in a sibling table makes
  the "frozen after draft" rule enforceable at the repository/DB level and keeps
  `players` focused on current state.

## Consequences

- Migration work: create `players.status`, create `player_draft_profile`, create
  `player_season_ratings`, backfill existing prospects into `players` with
  `status = 'prospect'` and their pre-draft fields into `player_draft_profile`,
  then drop `draft_prospects`. One Drizzle migration per structural change,
  generated via `drizzle-kit generate`.
- An index on `players(status)` — likely partial (`WHERE status = 'prospect'`) —
  since the prospect pool is a hot read and small relative to all-time players.
- The repository layer grows a `findDraftEligiblePlayers` function and a
  `draftPlayer(playerId, teamId)` service method; no other code path mutates
  `status` or writes to `player_draft_profile` post-draft. Immutability of
  `player_draft_profile` is enforced at the repository layer (optionally
  reinforced by a DB trigger later).
- Scouting and draft-pool UIs become thin reads over the unified `players`
  table, filtering by `status = 'prospect'`. Post-draft, the same player page
  shows a "Pre-draft evaluation" section sourced from `player_draft_profile` — a
  historical archive that persists for the player's whole career.
- If we later need richer lifecycle states (`free_agent`, `injured_reserve`,
  `practice_squad`), we either extend the CHECK/enum or — if those states carry
  their own data — add a `player_status_events` log alongside `status`. This
  decision does not preclude that evolution.
- Follow-up: update the drafting and scouting north-star docs to reflect the
  unified model (the prospect is a player), and update the backend-architecture
  doc if the repository/service pattern for lifecycle transitions warrants a
  named example.
