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
  trading, and cap-compliance ADRs (Accepted)
- [0015 — Simulation resolution model: play-by-play core with fast-mode parity](./0015-simulation-resolution-model.md)
  — single play-by-play engine; fast mode is the same engine headless; seeded
  RNG; per-play event stream is canonical output (Accepted)
- [0016 — Contract structure: per-year breakdown with prorated signing bonus](./0016-contract-structure.md)
  — parent `contracts` + `contract_years` + `contract_bonus_prorations`; pure
  `computeCapHit` / `computeDeadCap`; void years in, post-June-1 and incentives
  deferred (Accepted)
- [0017 — League genesis as the default creation flow](./0017-league-genesis-default-creation-flow.md)
  — genesis is canonical; established mode is the secondary path (Superseded
  by 0021)
- [0018 — Genesis phase state machine](./0018-genesis-phase-state-machine.md) —
  extends ADR 0014 with a one-shot genesis phase sequence sharing the same
  `league_clock` row (Accepted)
- [0019 — Inaugural Year 1 calendar (no preseason)](./0019-inaugural-year-one-calendar.md)
  — Year 1 skips preseason and uses a compressed regular season scaled to league
  size; Year 2+ uses the recurring calendar (Accepted)
- [0020 — Phase-gated sidebar navigation](./0020-phase-gated-sidebar-navigation.md)
  — UI sidebar surfaces are gated by the active league phase (Accepted)
- [0021 — Deprecate established mode; genesis is the only creation flow](./0021-deprecate-established-mode.md)
  — removes the established-mode escape hatch; every league begins at genesis
  (Accepted, supersedes 0017)
- [0021 — Sim calibration harness: NFL bands as the sim's contract](./0021-sim-calibration-harness.md)
  — seed-sweep harness asserts sim aggregates against `data/bands/*.json`;
  three-gate tolerance (mean / spread / tails); CI fails the PR on drift
  (Accepted)
- [0022 — Fused owner/GM role as canonical](./0022-fused-owner-gm-role.md) — the
  user plays a combined owner/GM; no split role model (Accepted)
- [0022 — Per-league unique coach and scout generation](./0022-per-league-unique-coach-scout-generation.md)
  — every league gets its own freshly generated coach/scout pool; no shared
  global roster (Accepted)
- [0023 — Sim football completeness: close the gap to real football](./0023-sim-football-completeness.md)
  — retires ADR 0015's v1 deferral list; commits XP/2PT, real kickoffs and
  returns, overtime, penalty mechanics, defensive scores, 4th-down decisioning,
  clock management, and assignment-based matchups as in-scope (Accepted)
- [0027 — MVP league creation wizard scope](./0027-mvp-league-creation-wizard.md)
  — three-step wizard (name + readonly settings → team select → generation →
  dashboard); defers the rich founder journey into the in-dashboard phase state
  machine (Accepted)
- [0028 — Readonly league settings in MVP creation wizard](./0028-readonly-league-settings-mvp.md)
  — settings shown as disabled inputs for transparency; nothing is editable at
  creation time in v1 (Accepted)
- [0029 — Default 8 founding franchises with no count selector in MVP](./0029-eight-team-default-no-count-selector.md)
  — franchise count hardcoded to 8; no founder-facing control, even readonly
  (Accepted)
- [0030 — Synchronous league generation with progress UI](./0030-synchronous-league-generation-with-progress-ui.md)
  — coaches, scouts, founding pool, NPC franchises generated inline during a
  loading step; no background job, no resumability in v1 (Accepted)
- [0031 — Post-generation landing on the first in-dashboard genesis phase](./0031-post-generation-land-in-first-genesis-phase.md)
  — after generation the founder lands straight in the dashboard at the earliest
  incomplete genesis phase; no confirmation screen (Accepted)
- [0035 — Scouting advocacy and dissent event model](./0035-scouting-advocacy-dissent-event-model.md)
  — single append-only `scouting_events` log with typed kinds (report, advocacy,
  dissent, cross-check, media mock, director consensus); GM responses are a
  separate surface (Proposed)
- [0036 — League-wide scouting allowances](./0036-league-wide-scouting-allowances.md)
  — uniform per-franchise caps (30 visits, 10 workouts, 15 cross-checks) for the
  genesis scouting phase; scout quality shapes value, never quantity (Proposed)
- [0037 — Draft board data model](./0037-draft-board-data-model.md) — tiered
  board (`draft_boards` + tiers + entries) with an append-only decision log
  linking moves to the scouting events that motivated them (Proposed)
- [0038 — Scouting director consensus logic](./0038-scouting-director-consensus-logic.md)
  — weighted aggregation of scout grades driven by hidden director attributes
  (`staff_reading`, `bias_awareness`, `tier_discipline`); bias correction
  disabled in genesis (Proposed)
- [0039 — Scouting flavor text generation strategy](./0039-scouting-flavor-text-strategy.md)
  — author-written templates with a resolver abstraction; MVP is deterministic,
  LLM swap is a single DI change (Proposed)
