# 0002 — Coaches page: org chart tree + coach detail view

- **Date:** 2026-04-13
- **Status:** Accepted
- **Area:** coaches — see [`../north-star/coaches.md`](../north-star/coaches.md)

## Context

The coaches page is where the GM inspects the staff he's hired. The north-star
doc is clear that coaches are opaque (no OVR, no attribute sliders) and that
what the user evaluates is resume, reputation, unit results, and development
patterns over time. The page needs to present the staff as an organization — not
a spreadsheet — and give the GM a way to drill into any coach's career.

## Decision

Ship a coaches page with two surfaces: a **Staff Tree** (the landing view, a
hierarchical org chart from HC down to position coaches and assistants) and a
**Coach Detail** page (one route per coach, showing his career, track record,
and tenure under the current franchise). No ratings, no overalls, no hidden
attributes surfaced anywhere.

## Requirements

### Staff Tree view

- Render the coaching staff as a tree rooted at the Head Coach.
  - HC → OC, DC, STC → position coaches under the appropriate coordinator →
    assistants under position coaches.
- Each node shows: name, role, age, years with team, contract years remaining.
- No rating, grade, or "coach OVR" on any node.
- A small badge marks play-calling responsibility on the HC node (offense /
  defense / CEO-type delegating both).
- Clicking a node navigates to that coach's detail page.
- Vacancies render as empty nodes with a "Hire" affordance that routes to the
  hiring flow (out of scope for this PRD, but the slot must be addressable).
- The tree is read-only. Reassigning roles, firing, or reorganizing the staff is
  not done from this view.

### Coach Detail page

One route per coach. Sections, in order:

- **Header** — name, current role, age, contract (years + salary + buyout),
  years with team, coaching tree lineage (mentor → mentor → coach).
- **Resume** — full career history: every stop, role, years, and the team's
  record / unit rank during his tenure where applicable. This is the "public
  record" described in the north-star doc.
- **Reputation** — league-generated labels (e.g. "offensive innovator,"
  "players' coach"). Labels only, no numeric backing.
- **Tenure with this team** — scoped to his time on the current staff:
  - Unit performance by season (offense/defense/ST rank depending on role).
  - Player development trajectories for players in his group — who improved, who
    stagnated, who regressed, season over season.
  - Scheme tendencies his unit has run (run-pass split, blitz rate, formation
    usage — whatever applies to his role).
  - Depth chart decisions of note (e.g. started the veteran over the rookie for
    N games).
- **Accolades** — Coach of the Year votes, championships, Pro Bowl selections
  attributable to his position group, any league awards.
- **Connections** — other coaches he's worked with, who mentored him, who he's
  mentored. Links to their detail pages when they're in the sim.

### Out of scope

- Editing any coaching attribute or assignment from this page.
- Issuing directives (belongs on its own directives surface).
- Hiring, firing, contract negotiation, or interview flows.
- Any numeric rating, grade, tier, or OVR for a coach.
- Attribute reveals of any kind, even partial ("we think his play-calling is
  above average"). The sim never confirms hidden values.
- Scheme installation / playbook editing.

## Alternatives considered

- **Flat list of coaches** — rejected. Hides the HC→coordinator→position-coach
  hierarchy that is the whole point of a staff, and makes the play-calling /
  reporting relationships invisible.
- **Position-grouped tables (one per unit)** — rejected for the landing view for
  the same reason. Tables optimize for comparison; the tree optimizes for
  _structure_, which is what the user is evaluating.
- **Expose a "coach grade" derived from unit performance** — rejected. Collapses
  into an OVR by another name and violates the north-star rule that judgment
  comes from watching patterns over years, not a number.
- **Inline coach detail in a drawer/modal** — rejected. Career history, resume,
  and tenure data is too dense for a drawer and deserves a shareable URL so the
  user can jump directly to a coach from other pages (roster, hiring,
  directives).

## Consequences

- Requires the sim to publish a stable staff hierarchy artifact and per-coach
  career records (resume, unit ranks by season, player dev deltas tied to
  coach).
- Coaching tree / mentor lineage must be modeled as data, not prose — the detail
  page links across coach records.
- The page will feel information-light compared to a typical "coaches screen" in
  other football games. That's intentional. The density comes from watching
  careers unfold across seasons, not from stats-in-a-glance.
- Future PRDs will cover the hiring/firing flows, the directives surface, and
  any league-wide coaching carousel view. This page is the inspection surface
  only.
