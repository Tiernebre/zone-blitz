# 0004 — NPC portraits: generic silhouette placeholder

- **Date:** 2026-04-13
- **Status:** Accepted
- **Area:** cross-cutting — applies to any surface that renders a person
  (players, coaches, scouts, owners). See
  [`../north-star/player-attributes.md`](../north-star/player-attributes.md),
  [`../north-star/coaches.md`](../north-star/coaches.md).

## Context

Roster, coach, and scout surfaces all render rows of NPCs. Right now those rows
are text-only, which reads as a spreadsheet rather than a league full of people.
A portrait slot — even a placeholder — changes the feel of every inspection
surface we've shipped (0001, 0002, 0003) from "data table" to "dossier."

We also don't yet know the right art direction. The realistic options range from
stylized SVG layer compositing (OOTP/Football Manager aesthetic) to a
pre-generated photoreal headshot pool (AI-generated once, assigned by seed) to
full on-demand AI generation. Each has a different art and cost profile, and
we'd be guessing at the answer before we've seen portraits in place on a real
surface.

## Decision

Ship a single, generic **head-and-shoulders silhouette** SVG as the portrait for
every NPC, everywhere a portrait slot exists. Same asset for every person — no
per-NPC variation yet. The component accepts a size and themes via
`currentColor`; it takes no player/coach data as input beyond what's needed for
the accessible label (name, role).

This is a deliberate placeholder. It establishes the portrait slot in the UI
without committing to an art direction or spending art/AI budget before we know
where portraits pull their weight.

## Requirements

- A reusable `Headshot` component in `client/src/components/`.
- Renders a filled bust silhouette (head + shoulders, no features) via inline
  SVG with `viewBox` so it scales cleanly.
- Uses `currentColor` for the silhouette fill so it inherits theme/team accent
  colors from its parent.
- Accepts a size prop (or className pass-through) to render at roster-row size,
  detail-page-header size, and anywhere in between.
- Ships with an accessible label derived from the subject's name (e.g.
  `aria-label="Headshot of {name}"`), or `aria-hidden` when rendered purely
  decoratively alongside a visible name.
- Same silhouette for every NPC. No seeding, no variation, no
  male/female/position differentiation yet.
- No network calls, no external image URLs, no build-time asset pipeline. The
  SVG is inline in the component.

## Out of scope

- Per-NPC variation of any kind (procedural, seeded, AI-generated, or
  hand-authored).
- Gender, ethnicity, age, or position-based portrait differentiation.
- Uploading or customizing portraits (not a feature we've scoped).
- A portrait for team logos, stadiums, or non-person entities — those have their
  own visual identity decisions.
- Deciding the eventual real portrait system (layered SVG vs. pre-generated AI
  pool vs. on-demand generation). That is a separate future decision informed by
  what we learn with the placeholder in place.

## Alternatives considered

- **Ship nothing, keep text-only rows** — rejected. Leaves roster/coach/scout
  surfaces feeling like spreadsheets and delays learning where portraits matter.
  A placeholder is cheap enough that "wait until we have real portraits" is the
  wrong tradeoff.
- **Use a DiceBear style (Personas, Micah) as the placeholder** — rejected for
  now. DiceBear styles are biased toward young, slim, hipster-leaning aesthetics
  that read wrong on a 34-year-old nose tackle or a grizzled DC. If we seed
  per-NPC portraits with a style that's visibly off, the placeholder stops
  reading as a placeholder and starts making design claims we haven't made. A
  single neutral silhouette reads unambiguously as "not yet filled in."
- **Layered SVG compositing with AI-generated layer assets** — rejected as
  premature. This is a plausible eventual direction, but committing art
  direction and generation pipeline before we've validated the surface value of
  portraits is backwards.
- **Pre-generated AI headshot pool, assigned by seed** — rejected as premature
  for the same reason. Likely the right answer for photoreal, but the
  placeholder decision shouldn't presuppose the final one.

## Consequences

- Every inspection surface (roster, coach detail, scout detail, opponent roster,
  player detail) can add a portrait slot today without waiting on art.
- The UI will have identical silhouettes repeated across every row. That is the
  correct signal — it makes the "we haven't shipped real portraits yet" state
  obvious instead of hiding it behind procedural variety that looks
  almost-but-not-quite right.
- When we revisit real portraits, the component boundary is already in place:
  swap the SVG contents (or accept a seed/URL prop) without touching call sites.
- Future PRD will decide the real portrait system. Inputs to that decision:
  which surfaces actually benefit from per-NPC identity (likely player detail
  and coach detail first), what art budget we're willing to spend, and whether
  we want stylized-custom or photoreal-pooled as the aesthetic.
