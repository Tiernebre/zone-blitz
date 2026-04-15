# 0023 — Allocation draft as Year 1's only draft

- **Date:** 2026-04-15
- **Status:** Accepted
- **Area:** [Drafting](../north-star/drafting.md),
  [League Genesis](../north-star/league-genesis.md)

## Context

Year 1 of a genesis league needs a mechanism to distribute the founding player
pool across franchises. The pool includes every archetype — raw college
athletes, practice-squad journeymen, back-end veterans, middling pros — and
rookie-age talent is folded into this same pool rather than separated into its
own class.

[League Genesis](../north-star/league-genesis.md) Phase 5 specifies that the
allocation draft is Year 1's only draft, and
[Drafting](../north-star/drafting.md)'s League Genesis section points to this
rule, but no ADR captures the tradeoff or the alternatives that were considered
and rejected.

## Decision

**Year 1 of a genesis league runs exactly one draft: the allocation draft.** The
allocation draft uses randomized order (no prior standings exist to seed from)
and distributes the entire founding pool — veterans, journeymen, and rookie-age
talent alike — across all founding franchises. Undrafted players from the pool
enter free agency.

**The first true rookie draft happens in the Year 2 offseason.** It draws from a
fresh rookie class scouted over the course of Year 1, with draft order set by
Year 1 standings. Every subsequent offseason follows this standard cycle.

## Alternatives considered

- **Running both an allocation draft and a separate inaugural rookie draft in
  Year 1.** This would give Year 1 two distribution events: one for the founding
  pool and one for a carved-out rookie class. Rejected because it dilutes the
  narrative focus of genesis — the allocation draft is the founding event, and a
  second draft in the same year splits attention, complicates the already
  front-loaded Year 1 calendar, and forces the league to manufacture a separate
  rookie class before any real football has been played. It also means the
  inaugural rookie draft would use randomized order (no standings yet), robbing
  it of the competitive weight that a standings-seeded draft carries.

- **A single unified draft every year with no allocation/rookie distinction.**
  This would treat the founding pool and every future class identically — one
  annual draft, no special genesis event. Rejected because it erases the
  narrative distinctiveness of the league's founding. The allocation draft is a
  one-time event that marks the birth of the league; collapsing it into a
  generic annual draft loses the "first pick in league history" moment and the
  founding mythology that genesis is designed to create. It also removes the
  mechanical distinction between a randomized founding distribution and a
  standings-seeded competitive draft, flattening a meaningful design difference.

## Consequences

- **The first rookie draft carries real weight.** Because it's deferred to Year
  2, it's the first standings-driven draft in league history — no randomization,
  real competitive stakes. The worst team in Year 1 earns the first pick through
  on-field results, not a coin flip.
- **Year 1's narrative lands on the allocation draft without dilution.** There
  is one distribution event to build excitement around, one set of draft grades,
  one "first overall pick in league history" moment. Genesis stays focused.
- **Young players at founding compete directly with veterans for pool slots.**
  Rookie-age talent isn't protected or separated — they enter the same pool as
  everyone else and must earn roster spots through the same allocation draft and
  free agency process. This reinforces the scrappy start-up identity of a
  founding league.
- **The Year 1 calendar stays manageable.** A single draft event in the founding
  window avoids overloading the already compressed genesis sequence (charter →
  franchise establishment → staff hiring → allocation draft → free agency →
  kickoff).
- **No follow-up work required.** The north-star docs already reflect this
  model. This ADR formalizes the decision for future reference.
