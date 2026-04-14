# 0006 — Players are positionless; position is a lens, not a property

- **Date:** 2026-04-14
- **Status:** Accepted
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
   produces a coarse, stable bucket (see the resolved set under Neutral
   archetype map below) from attribute profile alone. This is the lens used on
   other teams' rosters, the trade finder, league leaderboards, and any
   pre-coach cold-start view.
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

- A single, versioned mapping function `neutralBucket(attributes) → bucket`.
- Deterministic and legible — the same attributes always produce the same
  bucket, and the rules are documented (not an opaque model).
- Used wherever the viewer has no scheme lens: unsigned FAs from the perspective
  of a team without a hired OC/DC, other teams in trade UI, league-wide lists,
  draft class browsing before you've committed a board.

#### Bucket set

The neutral bucket is one of:

**QB, RB, WR, TE, OT, IOL, EDGE, IDL, LB, CB, S, K, P, LS.**

Notes on the set:

- **OL is split into OT and IOL** (interior OL = G + C). A tackle's shape
  (length, lateral agility) and a guard/center's shape (anchor, short-area
  strength) diverge enough that a single `OL` bucket would reintroduce the same
  lie as `position`. Center vs. guard is a depth-chart slot distinction, not a
  neutral-lens one.
- **EDGE / IDL / LB / CB / S** are kept as the coarse front-seven and secondary
  buckets. Finer splits (3-tech vs. NT, nickel vs. boundary CB, free vs. strong
  S) are scheme-dependent and belong to the scheme lens.
- **Returner is dropped** from the proposed set. A returner is a depth-chart
  role, not an archetype; a fast WR/RB/CB with ball-carrying surfaces as a
  returner on the depth chart without needing a separate neutral label.
- **LS is kept** despite being niche — it is the one bucket where a player's
  snap accuracy is the only attribute that meaningfully qualifies him, and
  collapsing it into OL/TE loses that signal.

#### Classification rule

Each bucket is defined by a **signature** — a small set of attributes that
matter for that archetype — plus **size gates** where shape rules out
misclassification. A player is assigned to the bucket whose signature his
attribute profile scores highest on, subject to gates. The rule is a documented,
deterministic decision procedure, not a trained model.

Signatures (primary attributes listed; size gates in parentheses):

- **QB** — Arm strength, Accuracy (short/medium/deep), Release, Decision-making.
- **RB** — Ball carrying, Elusiveness, Acceleration, Speed (typical RB
  height/weight band).
- **WR** — Route running, Catching, Speed, Acceleration (typical WR band; a
  larger-frame WR is still WR, not TE, absent blocking competence).
- **TE** — Catching, Run blocking, Pass blocking (larger frame than WR;
  distinguishes from WR by non-trivial blocking competence, from OT by receiving
  competence).
- **OT** — Pass blocking, Run blocking, Agility (tall/long frame; taller and
  lighter than IOL on average).
- **IOL** — Run blocking, Pass blocking, Strength (shorter, heavier anchor frame
  than OT).
- **EDGE** — Pass rushing, Acceleration, Block shedding, Speed (edge-rusher
  frame — lighter than IDL, often taller).
- **IDL** — Strength, Block shedding, Run defense, Pass rushing (interior
  defensive frame — heavier than EDGE).
- **LB** — Tackling, Run defense, Zone coverage, Football IQ, Pursuit speed
  (mid-frame — lighter than IDL, heavier than S).
- **CB** — Man coverage, Zone coverage, Speed, Agility (DB frame).
- **S** — Zone coverage, Tackling, Football IQ, Anticipation (DB frame;
  distinguishes from CB by tackling + anticipation weight over pure mirror
  coverage).
- **K** — Kicking power, Kicking accuracy (gate: must clear a minimum on both to
  qualify).
- **P** — Punting power, Punting accuracy (gate: must clear a minimum on both).
- **LS** — Snap accuracy (gate: must clear a high snap-accuracy threshold; no
  other bucket uses this attribute as its primary signature).

Ties (a player who scores comparably on two signatures) are broken by a fixed
priority order so the output is stable: **LS → K → P** (specialists first) **→
QB → TE → EDGE → IDL → OT → IOL → RB → WR → LB → S → CB**. The specialists-first
rule ensures that e.g. a 6'3" 240lb player with elite snap accuracy classifies
as LS, not TE.

Rare **cross-archetype players** (the Travis Hunter case in the generator note
below) may tie between two non-specialist signatures. Priority order still picks
one deterministic primary bucket; the scheme lens and depth chart are where the
dual-role surfaces. The neutral lens is intentionally coarse — it produces one
bucket per player — and cross-archetype flavor lives downstream.

Exact numeric thresholds and signature weights are simulation-tuning concerns,
not product concerns, and are specified in the implementation's test fixtures
against the 0–100 scale and bell-curve distribution in
`../north-star/player-attributes.md`. This ADR fixes the bucket set, the
signature attributes per bucket, and the tie-break priority; the numeric
calibration is free to evolve behind that contract.

### Scheme lens

- A mapping `schemeLens(attributes, schemeFingerprint) → archetype | null`,
  producing the role-within-scheme label for your team's view. `null` means "not
  a fit at any role in this scheme" and is a valid, surfaceable answer.
- Used on your own roster, your depth chart editor, your draft board, your
  scout's reports, your FA shortlist, and Scheme Fit (0005).
- When the scheme fingerprint changes (coaching hire/fire), the lens recomputes;
  players can visibly shift labels, which is a feature, not a bug.

#### Fingerprint axes that feed the lens

The scheme fingerprint (per 0005) carries axes that range from "structural"
(they change which _shapes_ of player the scheme needs at all) to "tactical"
(they change how the scheme operates snap-to-snap, but not who it wants on the
roster). **Only structural axes feed the scheme lens.** Tactical axes affect
play-calling and the sim, not archetype assignment. This keeps the lens stable
across in-season strategy tweaks and makes it recompute only when coaching staff
changes.

Structural axes — **do** feed the scheme lens:

- **Offensive personnel weight (light ↔ heavy)** — drives how many WR and TE
  slots the depth chart exposes. A light-personnel (11/10) scheme surfaces WR3,
  WR4, WR5 as first-class archetypes; a heavy-personnel (12/21/22) scheme
  surfaces TE2 and FB archetypes instead.
- **Short ↔ vertical passing lean** — distinguishes possession/slot WR
  archetypes from vertical/burner X archetypes; biases the QB archetype
  (pocket-manager vs. gun-slinger).
- **Zone ↔ gap/power run game** — distinguishes zone-blocking OL archetypes
  (mobility, reach-block technique) from gap/power OL archetypes (anchor,
  down-block strength); distinguishes one-cut zone RB from power RB.
- **Timing ↔ improvisation + RPO integration** — biases QB archetype toward
  pocket-passer or mobile/dual-threat; biases WR archetype toward precise
  timing-route vs. scramble-drill improviser.
- **Defensive front (odd ↔ even)** — determines whether EDGE surfaces as
  stand-up OLB (3-4) or hand-in-dirt DE (4-3), and whether IDL surfaces as NT or
  3-tech/DE archetype.
- **One-gap ↔ two-gap** — two-gap IDL archetype demands more size/anchor;
  one-gap demands more penetration/quickness. Same player maps to different
  archetypes under each.
- **Base ↔ sub-package** — determines how many LB vs. DB slots the depth chart
  exposes. A dime-heavy scheme surfaces slot CB / nickel S archetypes as
  first-class; a base-heavy scheme surfaces SAM/MIKE/WILL LB archetypes.
- **Coverage lean (man ↔ zone) + press ↔ off** — distinguishes press-man CB
  (size, length, physicality) from off-zone CB (range, anticipation); biases S
  archetypes similarly.
- **Single-high ↔ two-high safety structure** — distinguishes box/strong S
  archetype (run support, match coverage) from free/deep S archetype (range,
  centerfield zone).

Tactical axes — **do not** feed the scheme lens:

- Tempo, formation diversity, pre-snap motion usage, four-man rush ↔
  blitz-heavy, disguise usage, aggressiveness on fakes/returns, field-position
  philosophy.

These affect simulation and play-calling but do not change the shape of player
the coach wants on the roster. They can tick week-to-week without causing the
lens to flicker labels on the Roster page.

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

_All open questions resolved in-line above (see "Bucket set" / "Classification
rule" under Neutral archetype map and "Fingerprint axes that feed the lens"
under Scheme lens). Kept as a section header for traceability with earlier
drafts._

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
