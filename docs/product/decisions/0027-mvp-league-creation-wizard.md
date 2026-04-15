# 0027 — MVP league creation wizard scope

- **Date:** 2026-04-15
- **Status:** Accepted
- **Area:** [League Genesis](../north-star/league-genesis.md)

## Context

[League Genesis](../north-star/league-genesis.md) describes a rich founder
journey: league charter, franchise establishment with per-slot identity
declarations, competitive staff hiring against NPC owners, a generated founding
player pool, a live allocation draft, founding free agency, and kickoff. That is
the canonical long-run experience.

It is also far more UI surface than we can ship as the first cut. The north-star
doc intentionally describes the end-state; the MVP needs a narrow slice that
gets a single-player founder from "click Create League" to "I'm in my dashboard"
on day one without requiring every genesis phase to be interactively designed
first. We need an ADR that states which slice of the founder journey is _in_ the
wizard and which lives inside the in-dashboard genesis phase state machine from
ADR 0018.

## Decision

**The MVP league creation wizard is a three-step linear flow that ends in the
dashboard:**

1. **League identity & settings** — a single page with the required league-name
   input at the top and the full league settings preview below it as disabled
   inputs (see ADR 0028). The founder names the league and reviews everything
   else it implies in one screen, then advances with a single Continue.
2. **Team select** — the founder picks one of the generated founding franchises
   by its branding. No identity overrides in the wizard.
3. **Generation** — a synchronous loading step that creates coaches, scouts, the
   founding player pool, and the NPC franchises inline (see ADR 0030), then
   lands the founder on the dashboard already in the first in-dashboard genesis
   phase (see ADR 0031).

**The rest of the founder journey — staff hiring, allocation draft, founding
free agency, kickoff — does not live in the creation wizard. It lives inside the
dashboard as the post-creation genesis phases defined by ADR 0018.** The
wizard's job is to produce a league row and hand off to the phase state machine;
it is not the place where the founder experiences the full narrative arc
described in the north-star.

## Alternatives considered

- **Ship the full north-star founder journey as the wizard.** Faithful to the
  vision, but it multiplies the design and implementation surface by roughly an
  order of magnitude before a single game of football can be played. Rejected
  for MVP; the north-star remains the target for the in-dashboard phase
  experiences.
- **Ship only league name + team select, no settings preview.** Slightly
  shorter, but hides from the founder what they're agreeing to (schedule length,
  cap rules, roster limits). Transparency at creation time is cheap and the
  settings preview doubles as a description of what the league _is_.
- **Split league name and settings preview into two separate pages.** Earlier
  draft of this ADR. Rejected: the settings screen is read-only, so it's a
  review surface, not a decision surface — pairing it with the one real input on
  that step (the name) keeps the wizard one beat shorter without losing any of
  the transparency the preview provides.
- **Ship a wizard with settings and team picker on the same page.** Compresses
  the flow further but conflates two genuinely different decisions: declaring
  what the league is vs. choosing which franchise inside it is yours. The
  team-select grid also wants the full page width that combining would steal.
- **Generate the league lazily on first dashboard interaction.** Avoids the
  loading step. Rejected because downstream systems (coach rosters, founding
  pool, NPC franchises) need to exist before any dashboard view can render, and
  the spinner is a natural narrative beat — "the league is being founded."

## Consequences

- **Makes easier:** shipping a playable league-creation path quickly. Three
  steps, one POST, one redirect.
- **Makes easier:** iterating on the in-dashboard genesis phases independently
  of the wizard. The wizard hands off to the phase state machine at a known
  point, so phase UI work doesn't block creation work and vice versa.
- **Makes harder:** reaching full north-star fidelity. The rich founder moments
  — declaring identity per franchise, the competitive staff-hiring market, the
  live allocation draft — are deferred into later ADRs and later UI work. The
  wizard as scoped here is a skeleton of the north-star vision, not a
  realization of it.
- **Makes harder:** multiplayer genesis. The wizard as scoped is single-player
  only — it assumes one founder making choices for one franchise, with seven NPC
  franchises auto-filled. Multiplayer claim flows will need a separate ADR when
  we get there.
- **Follow-up work:** ADRs 0028–0031 in this series pin down the specific
  sub-decisions this ADR gestures at (readonly settings, 8-team default with no
  count selector, synchronous generation, post-generation landing). The
  in-dashboard phase UI work tracks against ADR 0018's step catalog, not this
  ADR.
