# 0006 — Players are positionless; position is a lens, not a property

- **Date:** 2026-04-14
- **Status:** Proposed
- **Area:** player-attributes, schemes — see
  [`../north-star/player-attributes.md`](../north-star/player-attributes.md) and
  [`../north-star/schemes-and-strategy.md`](../north-star/schemes-and-strategy.md);
  builds on [`0001-roster-page.md`](./0001-roster-page.md) and
  [`0005-schemes-page-removal.md`](./0005-schemes-page-removal.md)

## Context

The north-star already says "a player has attributes" and that archetypes are
roles _within a scheme_, not labels stamped on a player
(`schemes-and-strategy.md:298-305`). Real rosters confirm it: a 250lb edge
rusher is an OLB in a 3-4 and a DE in a 4-3; the same receiver is a slot in one
offense and an X in another; a zone-scheme guard and a gap-scheme guard are
different players carrying the same position code. Persisting a fixed `position`
on the player entity forces a lie at the moment of data entry and then fights
every downstream system (scouting, FA, depth chart, sim) that needs to ask "fits
in _our_ system as a _what_?"

The same logic extends to personnel and roster construction: a spread offense
that runs 11/10 personnel values a fourth and fifth receiver more than it values
a blocking TE; a ground-and-pound offense values the reverse. "How many WRs does
this team need?" is a function of the coach's personnel tendencies, not a fixed
league rule. The position lens through which a GM views prospects and free
agents should reflect _his team's_ scheme, not a universal constant.

## Decision

Players do not have a position attribute. A player is a bag of attributes
(public and hidden), a contract, a history, and development state. "Position" is
always a **derived projection** that depends on the viewing lens:

1. **Neutral lens (league-wide baseline)** — a generic modern-NFL archetype map
   produces a coarse, stable bucket (QB / RB / WR / TE / OL / EDGE / IDL / LB /
   CB / S / K / P / LS / returner) from attribute profile alone. This is the
   lens used on other teams' rosters, the trade finder, league leaderboards, and
   any pre-coach cold-start view.
2. **Scheme lens (your team)** — when projected through your coach's personnel
   tendencies and scheme fingerprint (per 0005), the same player surfaces as an
   archetype-in-role: "slot WR," "move TE," "3-tech," "box safety," or sometimes
   "not a fit" at all. This is the lens used on your own roster, your depth
   chart, your draft board, your FA target list, and your scout reports.

No `position` column on the player table. No "select primary position" in any
create/edit flow. The depth chart is where a player is _slotted_ into a concrete
positional role for play; slotting is a coaching decision, not a statement about
the player.

## Requirements

### Player entity

- Remove `position` from the player model. Remove any derived-but-stored
  position fields. If the sim needs a positional role for a snap, it reads from
  the depth chart slot, not the player.
- Attributes remain the sole source of truth for what a player _can_ do.

### Neutral archetype map

- A single, versioned mapping function `neutralBucket(attributes) → bucket`,
  where bucket is one of the coarse labels above.
- Deterministic and legible — the same attributes always produce the same
  bucket, and the rules are documented (not an opaque model).
- Used wherever the viewer has no scheme lens: unsigned FAs from the perspective
  of a team without a hired OC/DC, other teams in trade UI, league-wide lists,
  draft class browsing before you've committed a board.

### Scheme lens

- A mapping `schemeLens(attributes, schemeFingerprint) → archetype | null`,
  producing the role-within-scheme label for your team's view. `null` means "not
  a fit at any role in this scheme" and is a valid, surfaceable answer.
- Used on your own roster, your depth chart editor, your draft board, your
  scout's reports, your FA shortlist, and Scheme Fit (0005).
- When the scheme fingerprint changes (coaching hire/fire), the lens recomputes;
  players can visibly shift labels, which is a feature, not a bug.

### Depth chart

- Depth chart slots are authoritative for "who plays what on game day."
- A player can occupy any slot the coach assigns; the sim penalizes miscast
  assignments through existing scheme-fit mechanics, not through a hard position
  rule.
- Slot definitions themselves are scheme-dependent — a spread team's depth chart
  has slots for WR4 and WR5; a ground-and-pound team's does not. The set of
  slots comes from the coach's personnel tendencies.

### Positional need (scouting / FA / draft)

- "Need at position" is evaluated through the scheme lens against the depth
  chart the scheme implies, not against a universal 22-position template.
- The spread-vs-ground-and-pound example is canonical: the same unsigned WR is a
  high-priority target for a spread team and a non-target for a ground-and-pound
  team, without any change to the player.

### Out of scope

- Editing or overriding the neutral or scheme lens from the UI. Lenses are
  deterministic views, not user-tunable filters.
- Surfacing raw archetype math / numeric fit scores (already forbidden by 0005).
- Historical position data in stat tables — stats are recorded against the depth
  chart slot the player occupied on that snap, which is fine and does not
  re-introduce a player-level position.

## Alternatives considered

- **Keep a coarse `position` field on the player as a filter aid** — rejected.
  Every value lies for at least one archetype (the EDGE / OLB, slot / X, move TE
  / slot WR cases); and once it exists, downstream code will depend on it and
  encode the lie. A derived neutral bucket gives the same filterability without
  asserting the lie on the entity.
- **Multiple positions per player (primary / secondary)** — rejected. Same lie,
  just more of it. Also invites edit UIs ("is he a primary DE or a primary
  OLB?") that replay the exact debate we're trying to escape.
- **Per-team overrideable position** — rejected. Collapses into "whatever
  position the user typed," which is indistinguishable from no design.
- **Purely attribute-derived with no persisted bucket, no lens** — rejected.
  Without _some_ bucket, cold-start views (new user, no coach hired; other
  teams' rosters in a trade UI) have no way to show a navigable list. Two
  explicit lenses solve this cleanly.

## Open questions

1. **Cold-start neutral lens** — the exact set of neutral buckets and the
   attribute rules that populate them need to be specified. Proposed starting
   set above, but this should be finalized before implementation so UI and data
   work aren't blocked by bikeshedding mid-build.
2. **Lens stability** — buckets and archetypes must not flicker when the user
   tweaks a minor scheme slider. The scheme lens should derive from the coach's
   **personnel tendencies** (11 vs. 12 personnel, nickel vs. dime base, etc.) —
   i.e. axes that change on coaching hires, not week-to-week strategy. Finalize
   which fingerprint axes feed the lens.

## Note for the future — player generation toward archetypes

Eliminating position on the entity does **not** mean players are generated with
uniform, evenly-distributed attribute rolls. Players must be generated with
**attribute profiles that lean toward recognizable archetypes**, or the neutral
and scheme lenses will have nothing coherent to project onto. A positionless
model is realistic _because_ real players have shapes — not because they're
blank slates.

Guidance for the generator (to be specified in its own design, not in this doc):

- **Generation samples an archetype (or small set of archetypes) first, then
  rolls attributes biased toward that profile.** "Gun-slinger QB" rolls high on
  arm strength / deep accuracy / aggressiveness, lower on short-accuracy
  discipline and pocket composure. "Zone-blocking guard" rolls high on mobility
  / football IQ, lower on raw anchor strength. The archetype seed shapes the
  distribution; the attributes, not the archetype label, are what persists on
  the player.
- **No player is elite at everything.** Attribute budgets / opportunity costs
  should enforce tradeoffs. A 99 arm / 99 accuracy / 99 mobility / 99 IQ QB
  should be effectively impossible. Every elite player is elite in a _shape_,
  not uniformly.
- **Rare cross-archetype players exist (the Travis Hunter case).** A small
  number of generated players have attribute profiles that qualify them for
  **two** neutral buckets (e.g. a player whose cover skills map to CB and whose
  route-running / ball skills map to WR). These players naturally surface in
  multiple lenses, and the depth chart / coaching staff decides which slot(s) to
  use them in — possibly both. This should be a rare event, not a routine
  outcome, and the generator should expose a tunable rate.
- **Archetype distribution is draft-class / era flavor.** Some draft classes are
  "deep at edge rusher," some are "weak at QB" — this is the generator tilting
  its archetype seeds for that class, which then ripples through scouting, draft
  boards, and positional scarcity naturally.

This note is intentionally not a requirement of 0006 — it's a flag that the
player-generation system has a hard dependency on archetype-aware rolls, and
that work should be scoped separately before a large player-generation pass
ships.

## Consequences

- Player create/edit flows lose a field; data model and migrations remove the
  column. This is a breaking data change — every referencing system (roster,
  depth chart, scouting, FA, draft, sim, stats, UI filters) needs to switch to
  either the neutral lens or the scheme lens.
- The roster mega-table (0001) needs a lens-aware position column. Default to
  scheme lens when a coach is hired, neutral lens otherwise. A future toggle
  ("show neutral buckets") may be useful but is not required for v1.
- Scouting (0003-scouts-page) reports naturally become scheme-aware — a scout's
  verdict on a prospect is stated in terms of _your_ scheme's archetypes, which
  adds flavor and depth to scouting as a surface.
- The scheme fingerprint (0005) grows a new consumer: the scheme lens. The
  mapping from fingerprint → lens output must be specified in the same technical
  design that 0005 already calls out for Scheme Fit.
- Depth charts become more interesting — spread teams literally have different
  slot configurations than ground-and-pound teams, driven by personnel
  tendencies. The depth chart UI must render slots dynamically from scheme, not
  from a fixed 22-slot grid.
- Historical / realism concern: when users see "Patrick Mahomes (QB)" on a
  roster, "QB" is a neutral-lens bucket, not a property. Most users will not
  notice; the few who do will benefit from the modeling.
