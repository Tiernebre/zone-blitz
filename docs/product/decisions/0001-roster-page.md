# 0001 — Roster page: active roster + depth chart view

- **Date:** 2026-04-13
- **Status:** Accepted
- **Area:** roster — see
  [`../north-star/player-attributes.md`](../north-star/player-attributes.md),
  [`../north-star/coaches.md`](../north-star/coaches.md),
  [`../north-star/statistics.md`](../north-star/statistics.md)

## Context

The roster page is where the GM sees the current 53-man team and the coach's
depth chart. It needs to reinforce the core invariant that the GM controls the
roster but the coach controls the depth chart.

## Decision

Ship a single roster page with three primary views — **Active Roster**, **Depth
Chart**, and **Statistics** — and no UI affordances that let the user override
the coach.

## Requirements

### Active Roster view

- List all 53 players on the active roster, grouped by position.
- Per player, show: name, position, age, cap hit, contract years remaining,
  injury status.
- No overall rating, grade, or any scout/attribute verdict on the player — the
  GM trusts the coaching staff's evaluation, not a number on a page.
- Sort/filter by position group, cap hit, age, contract years.
- Actions available: release, trade, restructure (opens relevant flow). No
  start/bench/promote actions.
- Show position-group totals: headcount and total cap $ per group.
- Show total roster cap $ and remaining cap space.

### Depth Chart view

- Read-only. Rendered from the coach's current depth chart.
- Grouped by position with ordinal slots (1st, 2nd, 3rd…).
- Per slot, show: player name, injury status. No overall rating.
- Surface game-day inactives as a separate list.
- Include a "last updated" timestamp and the coach who owns the chart.

### Statistics view

- Table of per-player season statistics, scoped to the current season by default
  with a selector for prior seasons and career totals.
- Columns adapt to position group (passing for QB; rushing for RB; receiving for
  WR/TE; defensive stats for front seven / secondary; kicking/punting for
  specialists).
- Support sort by any column and filter by position group.
- Per-player row links to a detail view with game-by-game splits.
- Stats reflect in-game sim output only; no fictional or projected numbers.

### Out of scope

- Drag-to-reorder, "set as starter," or any depth-chart editing UI.
- Practice squad, IR, waivers, weekly transactions log.
- Scheme fit indicators, snap counts, player development trends.
- Coach directives from this page (handled on the coaches page).

## Alternatives considered

- **Single combined view** — one table showing roster + depth-chart ordinal —
  rejected. Collapses the "GM picks 53, coach picks 11" distinction into one
  grid and invites editing affordances on the depth chart.
- **Editable depth chart with coach-override warnings** — rejected. Breaks the
  core fiction; coach autonomy is the game.
- **Defer depth chart to a later page** — rejected. The disconnect between
  roster and depth chart is the most important read on the page; shipping
  without it leaves the roster page feeling like a spreadsheet.

## Consequences

- Users who expect EA-style manual depth chart control will push back. The UI
  has to make the constraint feel intentional, not missing.
- Requires the coach sim to publish a stable depth-chart artifact the page can
  read.
- The roster page intentionally exposes no attribute-based evaluation of
  players. Judgment comes from stats, contract, age, and the coach's depth chart
  — not a rating. Scout-view of rostered players lives elsewhere if surfaced at
  all.
- Future PRDs will extend this page for practice squad, IR, and weekly
  transactions.
