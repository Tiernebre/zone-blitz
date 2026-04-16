# 0038 — Scouting director consensus logic

- **Date:** 2026-04-16
- **Status:** Proposed
- **Area:** [Scouting](../north-star/scouting.md),
  [0034 — Genesis draft scouting phase](./0034-genesis-draft-scouting-phase.md),
  [0035 — Scouting advocacy and dissent event model](./0035-scouting-advocacy-dissent-event-model.md),
  [0037 — Draft board data model](./0037-draft-board-data-model.md)

## Context

ADR 0034 commits to a "director's consensus board" presented at Week 4: NPC
franchises adopt it wholesale, and human franchises who never touched their own
board inherit it at lock. ADR 0037 defines the board shape the consensus writes
into. ADR 0035 defines the `director_consensus_update` event kind. What none of
these ADRs pin is _how_ the director actually aggregates scout reports into a
consensus ranking — the algorithm whose quality varies with the director's
hidden attributes.

Without a defined aggregation model, the director role becomes decorative — a
box to check in Phase 3 hiring with no observable downstream consequence. The
scouting north-star explicitly positions the director as "your top evaluator and
the person who synthesizes reports from the full staff," and ADR 0032's entire
case for a multi-week hiring process assumes those hires pay off in ways the
player can feel.

## Decision

The director's consensus is a **weighted aggregation of scout grades**,
re-computed incrementally whenever a new `report_published` event lands, and
emitted as a `director_consensus_update` event (from ADR 0035) when the delta
meaningfully changes tier placement or rank.

The director's hidden attributes drive three aggregation behaviors:

### 1. Scout weighting (`staff_reading`)

Better directors assign higher weight to grades from higher-accuracy scouts.
Weight is not uniform across the staff. Mathematically, the consensus grade for
a prospect is a weighted mean of scout grades where weights are
`staff_reading × scout_quality_estimate`. The weighting is **invisible to the
GM** — consistent with the information-asymmetry principle. The player discovers
over time that the director "trusts the right scouts" by observing consensus
accuracy improve year over year.

### 2. Bias correction (`bias_awareness`)

A director with high bias-awareness partially cancels known systematic biases in
his staff's grades (the mechanism the north-star describes under "Biases you'll
discover over time"). Bias correction depends on a track record of observed
scout outcomes — hit rate by position, bias direction, consistency over multiple
drafts.

**In genesis specifically, bias correction is disabled.** No prior drafts means
no observed outcomes means no bias model to correct against. This is a feature,
not a limitation: in genesis the director is working with the same imperfect
information the GM has, which reinforces the "year 1 is harder" feel.

### 3. Tier boundary placement (`tier_discipline`)

The director decides where tier breaks fall. A high-discipline director places
breaks at natural distribution gaps — when the grade histogram shows a cluster
of prospects, breaks don't split the cluster. A low-discipline director places
breaks mechanically (every 15 prospects, for instance) and produces an awkward
board where similar talent gets split across tiers.

For genesis, the director places tiers based on founding-pool archetype
distribution: raw college athletes, practice-squad journeymen, back-end vets,
and middling pros form natural clusters the director can (or can't) recognize.

### Incremental recomputation

When a new report lands, the director updates only the affected prospect's
aggregated grade and re-checks whether the update crosses a tier boundary. This
avoids recomputing the whole board on every event and keeps the
`director_consensus_update` stream focused on meaningful changes. If the update
only shifts rank within a tier, a lighter update event is emitted; if it crosses
a tier boundary, a full entry-move event is emitted.

### Visibility to the GM

The consensus board is always readable by the GM during the phase, marked
clearly as the director's board (not the GM's). The GM's own draft board (from
ADR 0037) is a separate artifact. At `scouting_board_lock`:

- If the GM touched their own board, their board is used.
- If the GM did not touch their own board, the consensus is copied to a
  `source = 'gm'` board (per ADR 0037's inheritance mechanism).
- NPC franchises always inherit the consensus.

The _weightings_, _bias corrections_, and _tier placement reasoning_ are never
shown to the GM. The GM only sees the resulting board.

## Alternatives considered

- **Simple arithmetic mean of scout grades.** Every scout counts equally; no
  director influence. Rejected: makes the director hire meaningless, defeats the
  entire point of Phase 3's scouting hires, and contradicts the north-star's
  framing of the director as a synthesizer.
- **Show the GM the weighting table ("Director weights your ACC scout at
  1.3x").** Rejected: violates information asymmetry. The player should infer
  director quality from consensus accuracy over years, not read it off a
  dashboard.
- **Bias correction enabled from year 1 with synthetic priors.** Seed the
  correction table with generic position-level biases (e.g., "OL grades are
  systematically too high"). Rejected: injects designer opinions into the game
  as if they were discovered truths; cleaner to start with a blank slate and let
  bias correction emerge from real observed data in year 2+.
- **Director-only global ranking; tiers are GM-only.** The director produces one
  flat list; the GM groups into tiers themselves. Rejected: tiering is exactly
  what real NFL directors do, and stripping it from the director makes the
  consensus board less useful as a recommendation.
- **LLM synthesis of scout reports into a qualitative recommendation.** Rejected
  for v1 on the same cost/determinism grounds as ADR 0039. The mathematical
  aggregation described here is stable, testable, and compatible with the
  calibration harness (ADR 0021).

## Consequences

- **Director attributes become observable.** `staff_reading`, `bias_awareness`,
  and `tier_discipline` now shape what the GM sees on the consensus board. A
  great director hire from Phase 3 produces a sharper consensus; a poor one
  produces a consensus the GM has to second-guess.
- **The consensus board is a first-class artifact.** It's persisted, it emits
  events, it participates in the decision log via the inheritance path in
  ADR 0037.
- **Testability.** The aggregation is a pure function over scout grades and
  director attributes; unit tests with synthetic fixtures validate behavior
  without needing a full phase simulation. The sim calibration harness
  (ADR 0021) gets a new assertion: consensus accuracy should correlate with
  director hidden attribute quality across seeded runs.
- **Year 2+ gets richer automatically.** As real draft outcomes accumulate, bias
  correction activates without code changes — the system naturally becomes more
  sophisticated as the league ages. The "learning your scouts" meta-game
  described in the scouting north-star lives partially inside the director.
- **Follow-up work:**
  - Implement the weighted-aggregation function with `staff_reading` and
    `tier_discipline` inputs; stub `bias_awareness` to a no-op for genesis.
  - Add a `director_consensus_boards` projection (or reuse `draft_boards` with
    `source = 'director_consensus'` per ADR 0037) that materializes the current
    consensus.
  - Wire consensus recomputation to the `report_published` event hook so updates
    are incremental.
  - Add calibration harness assertion: consensus grade error correlates
    inversely with director `staff_reading`.

## Related decisions

- [0021 — Sim calibration harness](./0021-sim-calibration-harness.md)
- [0032 — Multi-week staff hiring process](./0032-multi-week-staff-hiring.md)
- [0034 — Genesis draft scouting phase](./0034-genesis-draft-scouting-phase.md)
- [0035 — Scouting advocacy and dissent event model](./0035-scouting-advocacy-dissent-event-model.md)
- [0037 — Draft board data model](./0037-draft-board-data-model.md)
