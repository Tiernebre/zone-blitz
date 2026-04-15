# 0026 — Founding player pool composition and attribute normalization

- **Date:** 2026-04-15
- **Status:** Accepted
- **Area:** [League Genesis](../north-star/league-genesis.md),
  [Player Attributes](../north-star/player-attributes.md)

## Context

When a Zone Blitz league is created, there is no prior season to draw veterans
from. The league must generate a founding player pool from scratch and assign
attributes to every player in it. Two linked decisions govern how this works:
what narrative archetypes compose the pool, and how those players' attributes
relate to the league's own scale.

[League Genesis](../north-star/league-genesis.md) (Phase 4) defines four
narrative archetype categories for the founding pool and states that attributes
are normalized to the league's own talent distribution.
[Player Attributes](../north-star/player-attributes.md) documents the
league-local normalization rule in its "Attributes are normalized to _this_
league" subsection. Both docs treat these as established design, but no dated
ADR ratifies either decision — leaving future contributors without a clear
record of the intent and tradeoffs involved.

## Decision

**Decision 1: The founding player pool is generated from four narrative
archetype categories.**

Every player in the Year 1 pool belongs to one of four lore categories that
shape how the player is presented in scouting reports, profiles, and media
coverage:

- **Raw college athletes** — undrafted prospects, small-school talents, and late
  bloomers who slipped through existing pro football pipelines
- **Practice-squad journeymen** — players from other leagues who never got
  meaningful snaps and want a real opportunity
- **Back-end veterans** — players on the tail end of careers in other leagues,
  still chasing proof they belong, willing to bet on an upstart league
- **Middling pros** — players who never broke through elsewhere and are gambling
  they can become stars where the ceiling is wide open

These categories are purely narrative. They influence backstories, media
framing, and scouting-report flavor — but every player in the pool shares a
single mechanical attribute model. There is no separate generation formula,
attribute range, or development curve per archetype. The archetypes exist to
make the founding draft feel like assembling a roster from real people with
distinct histories, not to create mechanical subclasses.

**Decision 2: Attributes are normalized to the league's own talent
distribution.**

A founding-era player's ratings reflect their value within _this league_, not
within an external real-world football hierarchy. The league's 0-100 attribute
scale is calibrated to the talent pool that actually exists in the league at any
given moment:

- A 90+ player in a young genesis league rates as league-top, regardless of how
  that absolute skill level compares to an NFL-equivalent scale
- The 50-point starter/backup boundary applies within the league's own talent
  pool
- The bell-curve distribution documented in
  [Player Attributes](../north-star/player-attributes.md) holds from Year 1
  onward — the shape is the same, only the absolute talent level the scale maps
  to differs between a young league and a mature one

## Alternatives considered

- **Single-archetype generation (homogeneous pool).** Generate all founding
  players as a single undifferentiated mass with no narrative backstories.
  Simpler to implement, but strips the allocation draft of the storytelling that
  makes it feel like assembling a roster from real people. The four archetypes
  add narrative texture at zero mechanical cost — rejecting them would sacrifice
  flavor for no engineering benefit.

- **External scale anchored to an NFL-equivalent baseline.** Rate founding-pool
  players on an absolute scale where a 90 means "NFL-caliber elite" — which
  would place most genesis players in the 20-50 range. Rejected because it makes
  the early league feel like a minor league rather than a league that takes
  itself seriously. Stars should feel like stars from day one; the scale should
  serve the league the player is actually in, not an external reference the game
  never simulates.

- **Per-save calibration exposing absolute-vs-relative ratings.** Show players
  both a league-relative rating and an absolute rating, letting users toggle
  between them. Rejected because it introduces a concept the game has no use for
  (absolute skill relative to what?), complicates the UI with a toggle that
  invites unfavorable comparisons to a league that doesn't exist in the game,
  and undermines the design principle that the league's own scale is the only
  scale that matters.

## Consequences

- **Simulation consumes league-local attributes.** The game engine never needs
  an external reference scale. Every system — play resolution, depth charts,
  awards, stat generation — operates on the league's own normalized values.
- **Leaderboards and awards treat league-top as top.** The league's first MVP is
  a legitimate MVP within this league's context. Media, record books, and Hall
  of Fame evaluation all respect the league-local scale without qualification.
- **Cross-save comparisons are meaningless.** A 90-rated QB in one save is not
  equivalent to a 90-rated QB in another save. Each league's attributes reflect
  that league's talent distribution. This is by design — saves are independent
  universes.
- **The scale drifts upward as the league matures.** As generational rookies
  enter via annual drafts and coaching quality compounds over seasons, the
  absolute talent level that a given rating maps to rises. A Year 20 league's
  70-rated starter is likely a better football player in absolute terms than a
  Year 1 league's 70-rated starter — but both are franchise-caliber starters
  within their league's context.
- **Archetype categories are a generation-time and presentation concern only.**
  No downstream system needs to branch on a player's founding archetype. The
  attribute model, development system, and simulation engine are
  archetype-agnostic.
