# 0009 — Archetype-aware player generator

- **Date:** 2026-04-14
- **Status:** Accepted
- **Area:** player generation, league creation — builds on
  [`0006-positionless-players.md`](./0006-positionless-players.md) (see the
  "Note for the future — player generation toward archetypes" section).

## Context

ADR 0006 flagged that the player generator must produce attribute profiles that
lean toward recognizable archetypes, or the neutral and scheme lenses have
nothing coherent to project onto. The backlog entry
(`2026-04-14 — Archetype-aware player generation`) captures the same need.

The v1 stub generator (`createStubPlayersGenerator`) shipped a seed-enough
skeleton: every player has baseline 30 / potential 60, fixed height and weight
per bucket, fixed `"State University"` college, fixed `2000-01-01` birthdate,
and a flat `salaryCap / rosterSize` contract. That was sufficient to drive
neutral-bucket classification, but it produces visually identical leagues,
undifferentiated rosters, and no star-vs-scrub gradient. This ADR locks in the
shape of the first real pass.

## Decision

The player generator graduates in place. The factory name
(`createStubPlayersGenerator`) is kept for now — its consumers (service wiring,
league-creation path) do not change; the internals produce realistic
distributions instead of constants. Name generation is consumed through an
injected `NameGenerator` dependency so it can later be swapped for the shared
name generator being extracted in a parallel PR without another round of wiring
changes here.

### Distribution requirements

1. **Attributes are rolled on an approximately-normal distribution per
   archetype.** Signature attributes (per ADR 0006 bucket rules) are shifted up;
   off-signature attributes are shifted down; a per-player overall "quality"
   factor nudges the whole vector so stars, starters, and scrubs exist in
   realistic proportions (rough target: a handful of 85+ overall per roster, a
   long middle around 65–75, a tail in the 50s for depth).
2. **Potential is current + a non-negative lift**, larger for younger players
   and smaller as the player ages. Potential never drops below current and never
   exceeds 99. This produces veterans near ceiling and rookies with room to grow
   without letting every player rate identically.
3. **Height and weight vary within bucket-appropriate ranges.** Ranges are
   chosen so the output still classifies into the intended bucket under
   `neutralBucket()` (ADR 0006 size gates); they do not fix a single value per
   bucket.
4. **Ages span a rookie-to-veteran curve.** Rostered players and free agents
   sample ages across roughly 21–36; prospects sample 20–23 for a draft-eligible
   class. Birthdates are derived from ages + a current-year anchor (defaults to
   the current UTC year; injectable for tests).
5. **Colleges and hometowns come from real pools.** Colleges are drawn from the
   seeded `DEFAULT_COLLEGES` list (FBS/FCS programs). Hometowns are drawn from
   the seeded `DEFAULT_CITIES` list in `"{city}, {state}"` format. Undrafted
   players still get a hometown.
6. **Contracts reflect position value and player quality, not an even split.**
   Position tier (premium: QB / EDGE / OT / CB / WR; mid: TE / IOL / IDL / LB /
   S / RB; base: K / P / LS) combines with a quality score derived from
   attributes to produce an annual salary in a band per tier × quality. Years
   vary (1–5) with veterans on shorter deals; guaranteed money and signing bonus
   scale with quality; the team's total annual salary is scaled down uniformly
   if it would exceed the cap.

### Determinism

The generator accepts an injectable `random: () => number` factory (default
`Math.random`). Tests construct the generator with a seeded RNG so every
assertion in the suite is deterministic. Distribution invariants the suite
relies on (bucket composition, age range, attribute ranges, cap budget) are
asserted in tests.

### Cross-archetype players

The Travis Hunter case is explicitly out of scope for this PR. A follow-up
backlog entry covers it: a small, tunable fraction of generated players should
roll attribute vectors that qualify for two non-specialist signatures. Adding it
later does not require re-thinking this design.

## Alternatives considered

- **Full Perlin-noise / Gaussian-mixture generator** — too much complexity for a
  v1 graduation. The normal-around-archetype pass gives most of the realism with
  a legible implementation we can test deterministically.
- **Ship archetype seeds but keep flat height/weight/age/college/contract** —
  rejected. The visible realism (age curve, varied colleges, differing
  contracts) is most of the player-feel win; attribute distribution alone is
  invisible to casual users.
- **Move generation into a shared package** — premature. The generator is
  server-side; coaches, scouts, and front-office generators will stay in their
  feature folders.

## Consequences

- League creation now produces visibly differentiated rosters. Screenshots in CI
  / preview environments will no longer show 30 / 60 across the board.
- `BUCKET_PROFILES` keeps its role as the single place that defines
  per-archetype bias — tuning realism is one edit away.
- Contract generator is coupled to attribute quality. If the attribute
  distribution changes, the contract band may need re-tuning, and that is fine —
  both are owned by this feature.
- The archetype-aware-generation backlog item is resolved; the cross-archetype
  follow-up becomes its own backlog entry.
