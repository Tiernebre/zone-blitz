# 0010 — League-creation cap situations

- **Date:** 2026-04-14
- **Status:** Accepted
- **Area:** salary cap, league creation — builds on
  [`salary-cap.md`](../north-star/salary-cap.md) and
  [`0009-archetype-aware-player-generator.md`](./0009-archetype-aware-player-generator.md).

## Context

ADR 0009 graduated the player generator to produce contracts from a position
tier × quality band, then scaled each team's total down uniformly if it exceeded
the cap. That keeps every team legal, but it also flattens every team to roughly
the same cap posture on day one — which contradicts the salary-cap north-star.
The real NFL has a few teams pressed against the ceiling (stars just extended,
restructures stacked), a large middle, and a handful of flush rebuilders.
Day-one uniformity robs the user of the most legible piece of team identity at
the "pick your team" moment: the financial situation they're inheriting.

We also want team selection to preview this, not hide it, so the user can
deliberately pick "cap hell with a contender roster" or "flush rebuild" without
having to cross-reference a cap screen.

## Decision

At league creation, each team is assigned a **cap situation archetype** drawn
from a league-wide distribution. The archetype steers contract generation for
that team so the resulting total cap committed lands in the band that defines
the archetype. The team-select screen surfaces the archetype as a qualitative
badge plus the committed / available split.

### Archetypes and target distribution

Four archetypes, expressed as a fraction of the hard cap committed before league
play begins:

- **Cap hell** — 95–103% committed (can be slightly over; user must trim to
  comply by the first deadline). ~15% of teams.
- **Tight** — 88–95% committed. ~25% of teams.
- **Balanced** — 75–88% committed. ~35% of teams.
- **Flush** — 55–75% committed. ~25% of teams.

Rates are tunable constants, not hard-coded per team. The league-creation RNG
(same seeded `random` already threaded through the generator in ADR 0009)
assigns archetypes by sampling without replacement against these weights, so a
32-team league reliably produces the full spread rather than, say, twelve Flush
teams by chance.

### Correlation with roster shape

Archetypes are not orthogonal to the roster the player sees — that is what keeps
them from feeling arbitrary:

- **Cap hell** skews older and star-heavy (a couple of 85+ overalls on
  premium-tier contracts), fewer rookie-scale contributors.
- **Tight** leans veteran-balanced.
- **Balanced** is the default spread ADR 0009 already produces.
- **Flush** skews younger, more rookie-scale contracts, fewer premium-tier
  veterans.

Concretely this is expressed as a small bias layered on top of the per-player
quality roll and age sampler from ADR 0009 — not a separate generator. The
archetype's committed-cap band is the authoritative constraint; the roster bias
is the mechanism that makes the band reachable without a uniform post-hoc scale.

### Contract scaling under the archetype

The ADR-0009 "scale every contract down uniformly if the team total exceeds the
cap" step is replaced with "scale so the team total lands inside the archetype's
band." Cap-hell teams are allowed to exceed 100% of the cap by a small margin
(configurable, default ≤3%) — this is the inherited non-compliance state that
the user will have to resolve in their first offseason, and it is a deliberate
part of the Cap Hell feel.

### Team-select surface

The team-select screen gains, per team card:

- A **cap situation badge** with the archetype label (`Cap Hell`, `Tight`,
  `Balanced`, `Flush`) — styled so Cap Hell reads as danger and Flush as
  opportunity.
- The **committed / total** numbers and **available space** (can be negative for
  Cap Hell).
- No projections, no dead-cap breakdown — this is a picker, not the cap page.

The badge label is the same vocabulary as the Flexibility score in the
salary-cap north-star, so the picker and the in-season cap page speak the same
language.

### Determinism

Archetype assignment consumes the same injected `random` factory the player
generator already uses, so seeded tests remain deterministic. Distribution
invariants (every archetype represented in a 32-team league within expected
tolerance, Cap Hell teams land in band, Flush teams land in band) are asserted
in tests.

## Alternatives considered

- **Generate independently, then label after the fact.** Would let the existing
  generator run unchanged, and we'd just bucket teams by their resulting cap
  percentage. Rejected: it produces a bell curve clustered around whatever the
  uniform scale-down lands on, so Cap Hell and Flush are rare and mushy. The
  point is to guarantee the spread, not observe it.
- **Per-team commissioner-set archetypes.** Overkill for league creation;
  belongs in a future custom-league / scenario-builder surface. The randomized
  default is what every new league needs.
- **More archetypes (e.g. "Rebuild with dead cap spike," "Contender on a
  budget").** Tempting, but each archetype needs a legible badge and a testable
  band. Four buckets is enough to carry the feel; we can split later if the
  feedback is that Cap Hell is doing too much work.
- **Show raw committed-cap percent only, no badge.** The number alone doesn't
  carry the vibe — 94% committed reads the same as 89% committed to most users.
  The qualitative label is the UX value.

## Consequences

- League creation produces a legibly varied cap landscape from the first screen.
  Team-select becomes a meaningful choice instead of a cosmetic one.
- ADR 0009's uniform post-hoc scaling is superseded by archetype-band scaling.
  The contract generator now takes an archetype as input.
- The Flexibility score vocabulary in the salary-cap north-star is now a live UI
  surface — anywhere else that wants to show cap health (roster header, cap
  page, standings) should reuse the same four labels.
- Cap Hell teams can start slightly over the cap, which means the first
  offseason flow must support a non-compliant starting state (cut / restructure
  to comply by the deadline). This is consistent with the north-star's
  "compliance deadline" mechanic but does mean that flow has to exist before the
  league actually advances past the offseason.
- NPC GM personalities (ADR-free, described in the salary-cap north-star) will
  eventually want to correlate with archetypes — a Gambler team should be more
  likely to spawn in Cap Hell, a Developer team in Flush. Out of scope here;
  archetype assignment is personality-blind for now.
