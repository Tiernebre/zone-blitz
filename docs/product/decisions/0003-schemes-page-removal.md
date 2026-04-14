# 0003 — Remove the standalone Schemes page; surface scheme as emergent

- **Date:** 2026-04-13
- **Status:** Accepted
- **Area:** schemes — see
  [`../north-star/schemes-and-strategy.md`](../north-star/schemes-and-strategy.md);
  builds on [`0002-coaches-page.md`](./0002-coaches-page.md)

## Context

The app currently has a `/schemes` route rendering a stub page. The
schemes-and-strategy north-star is explicit that **a GM does not pick a scheme
from a menu** — scheme emerges from coaching hires as the aggregate of each
coordinator's tendencies, principles, and preferences. A top-level "Schemes"
destination implies configuration that the design does not permit and duplicates
what the Coaches page is already supposed to express.

## Decision

Remove `/schemes` as a top-level route. The scheme concept is surfaced in two
places where it belongs:

1. A **Scheme Fingerprint** panel on the Coaches page, aggregating the
   tendencies of the currently hired HC, OC, DC (and STC where relevant) into a
   read-only identity view.
2. A **Scheme Fit** indicator on the Roster page, expressing how well each
   rostered player aligns with the current fingerprint.

No standalone page. No scheme picker. No "install a scheme" flow, now or later.

## Requirements

### Scheme Fingerprint panel (on Coaches page)

Lives on the Coaches page as a dedicated panel above or beside the Staff Tree.
It reads from the current staff — when a coordinator is vacant or changes, the
panel updates accordingly.

- **Offensive fingerprint** — the OC's aggregate tendencies, displayed as
  labeled spectrums along the axes named in the north-star:
  - Run/pass lean, tempo, personnel weight (light ↔ heavy), formation diversity,
    pre-snap motion usage, timing ↔ improvisation, short ↔ vertical, zone ↔
    gap/power run game, RPO integration.
- **Defensive fingerprint** — the DC's aggregate tendencies:
  - Odd ↔ even front, one-gap ↔ two-gap, base ↔ sub-package, coverage lean (man
    ↔ zone), single-high ↔ two-high, press ↔ off, four-man rush ↔ blitz-heavy,
    disguise usage.
- **Special teams** — abbreviated fingerprint for STC (aggressiveness on fakes /
  returns, field-position philosophy).
- **Head coach influence** — a badge noting where the HC overrides or biases a
  coordinator's natural lean (e.g. defensive HC who leans his DC more aggressive
  than the DC's baseline).
- Each spectrum is rendered as a position along a bar, **not** a numeric value
  and **not** a grade. No "scheme OVR."
- Tendencies are labels/positions only — the panel never surfaces the underlying
  hidden coach attributes (consistent with 0002).

### Scheme Fit indicator (on Roster page)

A column/badge on the active roster view expressing how a player's attributes
align with the current fingerprint at his position.

- Qualitative labels only — e.g. _Ideal fit_, _Fits_, _Neutral_, _Poor fit_,
  _Miscast_. No numeric percentages, no 0–100 fit score.
- Clicking/hovering reveals the _reasons_ in prose ("size and length match a
  press-man scheme"), not the underlying attribute values.
- Fit is **derived from public/known player attributes** against the scheme
  fingerprint — it must not leak hidden attributes the GM has not otherwise
  earned access to via scouting.
- Recalculates when the fingerprint changes (i.e. after a coordinator hire or
  fire).

### Out of scope

- Editing, picking, or "installing" any scheme element from anywhere in the UI.
  This decision forecloses that path.
- Any numeric scheme rating, scheme OVR, or fit percentage.
- League-wide scheme comparison / scouting of _opponents'_ fingerprints — may be
  revisited as a scouting-surface decision later.
- Code removal of the current `/schemes` route and stub component. Tracked as
  follow-up; this doc is the product decision, not the cleanup PR.

## Alternatives considered

- **Keep the page, make it read-only** — rejected. Even a read-only page
  elevates "Schemes" to a sibling of Roster / Coaches / Scouting, which
  misframes the mental model. Scheme is a _consequence_ of Coaches; it should
  live next to its cause.
- **Show the fingerprint as a separate drawer from anywhere** — rejected.
  Without a clear home, the fingerprint becomes floating context nobody
  discovers. Anchoring it to Coaches makes the causal link (coordinator →
  tendencies → scheme) legible.
- **Put the fingerprint on the league home dashboard** — rejected for v1.
  Dashboard real estate is for status/alerts; fingerprint belongs where the user
  can act on the cause (hiring coaches) and the effect (roster fit).
- **Numeric fit score on Roster** — rejected. A number invites optimization
  toward the number; a qualitative label keeps the focus on judgment and
  scouting.

## Consequences

- The Coaches PRD (0002) gains a new surface. A follow-up either amends 0002 or
  adds the Scheme Fingerprint panel as an addendum referenced from there.
- The Roster PRD (0001) gains a Scheme Fit column concept. Same treatment —
  amend or addendum.
- The sim must expose, per coordinator, the set of tendency positions on each
  named spectrum, and must recompute the aggregate fingerprint when staff
  changes.
- Scheme fit logic requires a mapping from fingerprint positions to the player
  attributes that matter at each position. This is non-trivial and should be
  scoped in its own technical design before the Roster indicator ships.
- Follow-up cleanup PR removes `/schemes` route, `Schemes` component, the nav
  entry, and associated tests.
- Future league-management UI that needs to reference "scheme" should link into
  the Coaches page, not a dedicated route.
