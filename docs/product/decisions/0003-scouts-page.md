# 0003 — Scouts page: org chart tree + scout detail view

- **Date:** 2026-04-13
- **Status:** Accepted
- **Area:** scouting — see
  [`../north-star/scouting.md`](../north-star/scouting.md)

## Context

The current page is labeled **"Scouting"**, which implies an active mechanism —
assigning coverage, spending scouting points, building the draft board. That is
a different surface (and a much bigger one). What the GM needs first, and what
mirrors the coaches experience he already has, is a place to **inspect the
scouting department as a staff** — who works for him, what their track record
looks like, and how the org is structured.

The north-star doc is explicit that scout attributes are hidden and that trust
in a scout is built over years by reading his resume, reputation, and track
record. The inspection surface has to honor that: no accuracy number, no "scout
OVR," no attribute reveal. Same philosophy as the coaches page
([0002](./0002-coaches-page.md)).

## Decision

Rename the nav entry from **"Scouting"** to **"Scouts"** and ship a page with
two surfaces: a **Staff Tree** (landing view — hierarchical org chart from the
Scouting Director down through national cross-checkers and area scouts) and a
**Scout Detail** page (one route per scout, showing his resume, reputation, and
track record with the organization). No ratings, no accuracy numbers, no bias
reveals.

The active-scouting mechanisms (assignments, scouting levels, budget allocation,
the draft board) are a separate surface and are out of scope for this decision.

## Requirements

### Staff Tree view

- Render the scouting staff as a tree rooted at the **Scouting Director**.
  - Director → national scouts / cross-checkers → area scouts grouped by region
    or conference.
- Each node shows: name, role, region/coverage area (for area scouts), age,
  years with team, contract years remaining.
- **Work capacity** (scouting points the scout can produce per cycle) is shown
  on the node — per the north-star doc, it is the one practical constraint that
  is NOT hidden.
- No accuracy, grade, or "scout OVR" on any node.
- Clicking a node navigates to that scout's detail page.
- Vacancies render as empty nodes with a "Hire" affordance that routes to the
  hiring flow (out of scope for this PRD, but the slot must be addressable).
- The tree is read-only. Reassigning regions, firing, or reorganizing the
  department is not done from this view.

### Scout Detail page

One route per scout. Sections, in order:

- **Header** — name, current role, coverage area, age, contract (years +
  salary), years with team, work capacity.
- **Resume** — full career history: prior organizations, roles, years,
  playing/coaching background before scouting. The "public record" described in
  the north-star doc.
- **Reputation** — league-generated labels (e.g. "respected ACC evaluator,"
  "known for small-school finds"). Labels only, no numeric backing.
- **Track record with this team** — scoped to his tenure on the current staff.
  This is the core of the page. It's evidence, not a verdict:
  - Prospects he evaluated, by draft year — his grade, the level of evaluation
    (quick look / standard / deep dive), and what actually happened to the
    player (drafted where, became starter/contributor/ bust, accolades).
  - Broken down by position group and by round tier so the GM can see patterns
    (e.g. "his DL grades vs. outcomes" vs. "his QB grades vs. outcomes") without
    the game labeling them.
  - Cross-check history — where his reports agreed or disagreed with other
    scouts, and who turned out to be closer to the truth.
- **Track record across the league** — aggregated, noisy, secondhand data from
  his time at prior organizations (per the north-star doc). Clearly marked as
  lower-confidence than in-house data.
- **Connections** — scouts and directors he's worked under or alongside. Links
  to their detail pages when they're in the sim.

### Out of scope

- Assigning scouts to prospects, regions, or missions.
- Spending scouting points, choosing scouting levels, or any draft-board
  construction.
- Hiring, firing, or contract negotiation flows.
- Any numeric rating, accuracy score, tier, or OVR for a scout.
- Bias reveals of any kind, even partial ("we think he overrates speed"). The
  sim never confirms hidden attributes — the GM draws conclusions from the
  evidence himself.
- Infrastructure spend (analytics, film resources) — that belongs on the
  scouting budget surface.

## Alternatives considered

- **Keep the "Scouting" label and cram the staff view in as one tab** —
  rejected. "Scouting" is the name of the active mechanism and conflates two
  different jobs (managing the staff vs. running a scouting cycle). The coaches
  page sets the precedent: the staff surface is named after the people on it.
- **Flat list/table of scouts** — rejected for the same reason it was rejected
  for coaches. Hides the Director → cross-checker → area-scout reporting
  structure that is how the department actually functions.
- **Surface a derived "scout grade" from past accuracy** — rejected. That's the
  OVR the north-star doc forbids, just laundered through retrospective data. The
  GM is supposed to form his own judgment from the evidence; pre-computing it
  defeats the entire meta-game.
- **Inline scout detail in a drawer/modal** — rejected. Resume, career history,
  and multi-year track record is too dense for a drawer and deserves a shareable
  URL so the GM can jump to a scout from elsewhere (draft board, post-draft
  retrospective, hiring flow).
- **Fold the draft-retrospective view into this page** — rejected for this PRD
  but noted. The retrospective tools described in the north-star doc (draft
  class report card, hit rate by round, scouting accuracy reviews) are their own
  surface; the scout detail page links INTO that surface filtered by scout,
  rather than reproducing it.

## Consequences

- Requires the sim to publish a stable staff hierarchy artifact and per-scout
  career records (resume, prior orgs, in-house evaluation log with outcomes
  attached).
- The evaluation log has to be stored in a way that can be sliced by scout ×
  position × round × year without exposing derived accuracy metrics — the page
  shows raw evidence, not pre-computed judgments.
- Cross-check history must be modeled as a first-class relationship between
  scout reports, not just aggregated.
- The page will feel information-light compared to typical "scouting screens" in
  other football games. That's intentional and matches the coaches page —
  density comes from watching careers and outcomes unfold across seasons.
- The existing `Scouting` route component and nav label need to be renamed to
  `Scouts`. Future PRDs will cover the active scouting surface (assignments,
  budget, scouting levels, draft board) and the hiring flow. This page is the
  inspection surface only.
