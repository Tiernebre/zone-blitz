# 0007 — Coaching scheme implementation: tendency vectors on coordinators

- **Date:** 2026-04-14
- **Status:** Accepted
- **Area:** schemes — see
  [`../north-star/schemes-and-strategy.md`](../north-star/schemes-and-strategy.md);
  builds on [`0002-coaches-page.md`](./0002-coaches-page.md) and
  [`0005-schemes-page-removal.md`](./0005-schemes-page-removal.md)

## Context

0005 established the product stance: scheme is emergent from coaching hires and
is surfaced only as a read-only Fingerprint on the Coaches page and a Fit
indicator on the Roster page. What's unresolved is the _data model_ and _compute
model_ that makes those surfaces possible.

The north-star is explicit on two points that constrain the implementation:

1. **Schemes are tendencies on spectrums, not labels.** Two coaches both called
   "zone-defense guys" can want completely different rosters. A `scheme_type`
   enum betrays the premise of the design.
2. **Scheme fit is emergent, not stored.** There is no hidden `fit: 72` on a
   player. Fit is the degree of alignment between a player's attributes and the
   demands of the current staff's tendencies — it changes the moment you hire a
   new coordinator, without any data migration.

The existing `coaches` table (`server/features/coaches/coach.schema.ts`) carries
role, specialty, contract, and lineage fields but **no tendency data**. That's
the gap this ADR closes.

## Decision

Model scheme as a **per-coordinator tendency vector** stored in a new
`coach_tendencies` table (1:1 with `coaches`). The team-level scheme is never
stored — it is computed on read as the composition of the currently-hired HC,
OC, DC, and STC's vectors. Scheme fit is likewise computed on read from
`(playerAttributes, staffTendencies, positionArchetypeWeights)` and is never
persisted.

Concretely:

1. **Tendency vectors live on coordinators, not on HC or team.** OC owns the
   offensive vector, DC owns the defensive vector, STC owns the special-teams
   vector. HC contributes a small set of _overrides_ (aggressiveness, 4th-down
   lean, situational bias) that can clash with his coordinators — that clash is
   itself gameplay (the north-star's "situational incoherence").
2. **Tendency values are numeric positions on named spectrums** (0–100 integers
   for storage; rendered as bar positions per 0005, never as numbers to the
   user).
3. **Fit is a pure function**, not a cached column.
   `computeSchemeFit(player,
   staff)` returns a qualitative label (Ideal /
   Fits / Neutral / Poor / Miscast) derived from a weighted dot product of
   attributes against the tendency-driven archetype weights at the player's
   position.
4. **First slice ships OC + DC only.** STC tendencies, HC overrides, and
   position-coach development effects are follow-ups, not v1.

## Tendency spectrums (v1)

The axes below come directly from the north-star's "Offensive tendencies" and
"Defensive tendencies" sections. Each is a 0–100 integer with defined poles.
Defaults for a freshly generated coordinator come from his generator archetype
(existing `stub-coaches-generator.ts` pattern extended).

**Offensive vector (OC):**

| Field                         | 0 pole             | 100 pole             |
| ----------------------------- | ------------------ | -------------------- |
| `runPassLean`                 | run-heavy          | pass-heavy           |
| `tempo`                       | methodical         | up-tempo / no-huddle |
| `personnelWeight`             | light (10/11)      | heavy (12/21/22)     |
| `formationUnderCenterShotgun` | under center       | shotgun/pistol       |
| `preSnapMotionRate`           | static             | motion-heavy         |
| `passingStyle`                | timing             | improvisation        |
| `passingDepth`                | short/intermediate | vertical             |
| `runGameBlocking`             | zone               | gap/power            |
| `rpoIntegration`              | none               | heavy                |

**Defensive vector (DC):**

| Field               | 0 pole            | 100 pole                      |
| ------------------- | ----------------- | ----------------------------- |
| `frontOddEven`      | odd (3-down)      | even (4-down)                 |
| `gapResponsibility` | one-gap penetrate | two-gap control               |
| `subPackageLean`    | base-committed    | sub-package heavy             |
| `coverageManZone`   | man               | zone                          |
| `coverageShell`     | single-high       | two-high                      |
| `cornerPressOff`    | press             | off                           |
| `pressureRate`      | four-man rush     | blitz-heavy                   |
| `disguiseRate`      | static looks      | heavy disguise / sim pressure |

Nine offensive + eight defensive = seventeen fields. Enough to differentiate the
"same-label, different-roster" case from the north-star; few enough that
generators, sim, and fit logic can all reason about the whole vector.

## Schema sketch

```ts
// server/features/coaches/coach-tendencies.schema.ts
export const coachTendencies = pgTable("coach_tendencies", {
  coachId: uuid("coach_id")
    .primaryKey()
    .references(() => coaches.id, { onDelete: "cascade" }),
  // Offensive — populated only when coach.specialty = 'offense' or role = 'OC'/'HC-offensive'
  runPassLean: integer("run_pass_lean"),
  tempo: integer("tempo"),
  personnelWeight: integer("personnel_weight"),
  formationUnderCenterShotgun: integer("formation_under_center_shotgun"),
  preSnapMotionRate: integer("pre_snap_motion_rate"),
  passingStyle: integer("passing_style"),
  passingDepth: integer("passing_depth"),
  runGameBlocking: integer("run_game_blocking"),
  rpoIntegration: integer("rpo_integration"),
  // Defensive — populated only when coach.specialty = 'defense' or role = 'DC'/'HC-defensive'
  frontOddEven: integer("front_odd_even"),
  gapResponsibility: integer("gap_responsibility"),
  subPackageLean: integer("sub_package_lean"),
  coverageManZone: integer("coverage_man_zone"),
  coverageShell: integer("coverage_shell"),
  cornerPressOff: integer("corner_press_off"),
  pressureRate: integer("pressure_rate"),
  disguiseRate: integer("disguise_rate"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

Nullable columns because a defensive coordinator has no offensive tendencies and
vice versa. One row per coordinator.

## Composition and fit — compute on read

A new `schemes` feature module exposes two pure functions:

```ts
// server/features/schemes/fingerprint.ts
computeFingerprint(staff: { hc, oc, dc, stc }): SchemeFingerprint
// -> { offense: OffensiveVector, defense: DefensiveVector, overrides: HCOverrides }

// server/features/schemes/fit.ts
computeSchemeFit(
  player: PlayerWithAttributes,
  fingerprint: SchemeFingerprint,
): SchemeFitLabel // 'ideal' | 'fits' | 'neutral' | 'poor' | 'miscast'
```

Fit is a weighted dot product: each spectrum position maps to attribute weights
at the player's position (e.g. a `coverageManZone` near the "man" pole raises
the weight on corner man-coverage and speed; near "zone" raises zone-coverage
IQ). The sum produces a score, bucketed into labels per 0005. The mapping table
lives in `schemes/archetype-weights.ts` and is the real content work — the
spectrums alone are empty without it.

**No caching, no stored fit column.** Fit is recomputed per view. The math is
cheap (bounded to ~20 multiplications per player per position) and staleness
from caching would directly contradict 0005's "recalculates when fingerprint
changes" requirement.

## Alternatives considered

- **Enum-based scheme (e.g. `scheme_type: '3-4' | '4-3' | 'spread' | …`)** —
  rejected. Betrays the north-star's core assertion that "the modern NFL doesn't
  run pure schemes" and that two coaches with the same label want different
  rosters. An enum collapses exactly the dimensions the game is about.
- **Tendencies stored on `team` instead of per-coordinator** — rejected. Makes
  firing/hiring a coordinator a team-level mutation; loses the ability to carry
  a coach's identity with him when he moves; obscures the causal chain (hire
  cause → tendency effect → roster consequence) the north-star is built on.
- **Tendencies as JSONB blob on `coaches`** — rejected. Queryable tendency
  distributions (scouting "find me a blitz-heavy DC under 50") become awkward;
  schema migrations for new spectrums become implicit; generators and fit
  functions lose type safety. A typed columnar table is worth the extra file.
- **Cache fit as a computed column on the roster table** — rejected. Fit must
  recompute instantly on coordinator change per 0005; caching adds an
  invalidation surface with no perf payoff given the math is trivial.
- **HC owns the whole vector; OC/DC are just hiring-slot labels** — rejected.
  The north-star is explicit that OC and DC bring their own tendencies, and the
  league-wide coaching-tree ecosystem (trees, hires, mentorships per
  `coaches.md`) depends on coordinators being first-class carriers of scheme
  identity.
- **Ship all seventeen spectrums plus STC and HC overrides in v1** — rejected.
  The archetype-weight mapping table (tendency → attribute weights by position)
  is the real content work; doing it for every spectrum at every position in one
  PR is a months-long blocker. OC + DC is enough to prove the model and light up
  the Coaches Fingerprint and Roster Fit surfaces.

## Consequences

- **Schema migration** adds a `coach_tendencies` table. Drizzle migration
  generated per CLAUDE.md convention. Seed/generator updates populate tendencies
  when a coach is generated.
- **Coach generation** must extend `stub-coaches-generator.ts` to produce
  plausible vectors. Coordinators should cluster into recognizable "trees"
  (Shanahan-like, Air Raid, Fangio-like) rather than uniform random — that
  clustering is what makes the hiring market legible.
- **Coaches Fingerprint panel (per 0005)** now has a concrete data source:
  `computeFingerprint(staff)` returns the spectrums the panel renders as bars.
- **Roster Fit indicator (per 0005)** now has a concrete function:
  `computeSchemeFit(player, fingerprint)` returns the qualitative label.
  _Content work remains_ — the archetype-weight mapping is the heart of fit and
  will need its own iteration.
- **Sim integration is deferred but unblocked.** The sim can read the same
  fingerprint and fit functions once it exists; this ADR does not commit to sim
  semantics.
- **Hidden attributes are not leaked.** Fit is computed from whatever attribute
  visibility the caller has; scouting-gated attributes remain scouting-gated.
  The fit label is a function of visible inputs only.
- **Follow-ups not in this ADR:**
  - STC tendency spectrum (return aggression, fake rate, field-position lean)
  - HC override vector (aggressiveness, 4th-down chart, situational biases)
  - Position-coach development effects on player growth (per `coaches.md`)
  - Archetype-weight mapping table content for all positions
  - Scheme-transition costs (roster fit degradation when a coordinator is
    replaced mid-season; the "1-2 season adjustment" the north-star references)
  - NPC AI using fingerprint similarity to evaluate coaching candidates

Each of the above warrants its own ADR or north-star update before
implementation.
