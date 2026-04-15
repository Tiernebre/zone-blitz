# Product Decisions

Short, dated records of specific product decisions. Each decision answers _why
we picked X over Y_ at a point in time. Decisions are immutable once merged — if
a later decision supersedes an earlier one, add a new entry and mark the old one
as superseded.

## How to add a decision

1. Copy [`TEMPLATE.md`](./TEMPLATE.md) to `NNNN-short-slug.md`, where `NNNN` is
   the next unused four-digit number.
2. Keep it short — aim for one page. If it's getting long, the decision probably
   belongs in a north-star doc instead.
3. If the decision changes the rules of a feature area, also update the relevant
   [`../north-star/`](../north-star/) doc and link back to this decision from
   the bottom of that doc.

## Log

- [0001 — Roster page: active roster + depth chart view](./0001-roster-page.md)
  — single page, two views, no depth-chart editing
- [0002 — Coaches page: org chart tree + coach detail view](./0002-coaches-page.md)
  — staff tree landing, one detail page per coach, no ratings surfaced
- [0003 — Scouts page: org chart tree + scout detail view](./0003-scouts-page.md)
  — rename "Scouting" nav to "Scouts"; staff inspection surface, no accuracy
  numbers
- [0004 — NPC portraits: generic silhouette placeholder](./0004-npc-portraits.md)
  — one shared head-and-shoulders SVG for every NPC; defer real portrait system
- [0005 — Remove the standalone Schemes page; surface scheme as emergent](./0005-schemes-page-removal.md)
  — kill `/schemes`, add a Scheme Fingerprint panel to Coaches and a Scheme Fit
  indicator to Roster
- [0007 — Coaching scheme implementation: tendency vectors on coordinators](./0007-coaching-scheme-implementation.md)
  — per-coordinator tendency spectrums in `coach_tendencies`; fingerprint and
  fit computed on read; OC + DC first
- [0008 — Generate tendency vectors for every coach, not just active coordinators](./0008-coach-tendency-generation-scope.md)
  — HCs and STCs get full generated vectors too; v1 application scope is
  unchanged from 0007
- [0012 — Depth chart section labels surface the scheme](./0012-depth-chart-scheme-section-labels.md)
  — group headers show "Base 3-4 · Nickel" / "11 Personnel" etc., derived from
  the fingerprint; row labels unchanged
- [0013 — Player detail page: biography, contract, and transaction history](./0013-player-detail-page.md)
  — one canonical `/players/:playerId` route; breadcrumb + browser back, no
  generic "← Back" link
- [0014 — Season calendar and phase state machine](./0014-season-calendar-phase-state-machine.md)
  — ordered phase enum + per-phase step catalog on a single `league_clock`;
  user-initiated advance with gated transitions; unblocks draft, FA, contracts,
  trading, and cap-compliance ADRs (Proposed)
- [0015 — Simulation resolution model: play-by-play core with fast-mode parity](./0015-simulation-resolution-model.md)
  — single play-by-play engine; fast mode is the same engine headless; seeded
  RNG; per-play event stream is canonical output (Proposed)
- [0016 — Contract structure: per-year breakdown with prorated signing bonus](./0016-contract-structure.md)
  — parent `contracts` + `contract_years` + `contract_bonus_prorations`; pure
  `computeCapHit` / `computeDeadCap`; void years in, post-June-1 and incentives
  deferred (Proposed)
- [0017 — League genesis as the default creation flow](./0017-league-genesis-default-creation-flow.md)
  — genesis is canonical; established mode is the secondary path (Proposed)
- [0018 — Genesis phase state machine](./0018-genesis-phase-state-machine.md) —
  extends ADR 0014 with a one-shot genesis phase sequence sharing the same
  `league_clock` row (Proposed)
- [0019 — Inaugural Year 1 calendar (no preseason)](./0019-inaugural-year-one-calendar.md)
  — Year 1 skips preseason and uses a compressed regular season scaled to league
  size; Year 2+ uses the recurring calendar (Proposed)
