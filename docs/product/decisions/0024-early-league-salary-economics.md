# 0024 — Early-league salary economics and the evolving cap curve

- **Date:** 2026-04-15
- **Status:** Proposed
- **Area:** [Salary Cap](../north-star/salary-cap.md),
  [Free Agency & Contracts](../north-star/free-agency-and-contracts.md),
  [League Genesis](../north-star/league-genesis.md)

## Context

The north-star documents describe a deliberately compressed Year 1 salary regime
— short contracts, modest guarantees, no mega-deals — that evolves into a mature
economy over many seasons. They also specify that every founding franchise
starts with identical cap space. However, no ADR pins down the specific
mechanics: how the compression is enforced, what drives cap growth, or how the
curve interacts with expansion cycles. This ADR codifies those rules.

## Decision

### Compressed founding-era contracts

Year 1 operates under a compressed contract regime:

- **Maximum contract length** during the allocation draft and founding free
  agency is **3 years**. No founding-era deal can extend beyond the league's
  third season.
- **Guaranteed money is capped** at a modest fraction of total deal value during
  Year 1. Players are betting on an unproven league; neither side has the
  leverage or precedent for large guarantees.
- **No void years** are permitted in founding-era contracts. Void-year
  manipulation requires a mature cap environment with historical precedent; in a
  start-up league the mechanism has no anchoring context.

These restrictions lift progressively as the league ages. By the end of the
compressed era (roughly seasons 1–3), the full contract toolkit — long-term
extensions, void years, mega-guarantees — becomes available as the market
develops precedent and stars accumulate leverage.

### Identical starting cap

Every founding franchise enters Year 1 with **the same cap number**. This is the
only moment in league history when the financial playing field is perfectly
level. Cap rollover, expansion-draft compensation, and divergent spending
decisions create asymmetry from Year 2 onward.

### Age-and-expansion-driven cap growth

Cap growth is **not** a static percentage applied uniformly every year. Instead,
it is driven by two factors:

1. **League age.** The cap grows each offseason by a base amount that increases
   as the league matures. Early-season growth is modest — reflecting a start-up
   league without a major media deal — and accelerates as the league establishes
   itself. The growth curve is concave: rapid gains in the middle seasons as the
   league proves viability, tapering toward a steady-state rate once the league
   is mature.
2. **Expansion events.** Each expansion cycle (new franchises joining the
   league) triggers a one-time cap inflection. More franchises mean broader
   market reach, new media markets, and increased revenue — the cap jumps when
   the league grows. The size of the inflection scales with the number of
   franchises added.

The combination produces a cap trajectory that is flat early, bends upward
through the middle seasons, and levels off at maturity — rather than the
straight-line growth of a fixed annual percentage.

### Interaction with free agency and star leverage

The compressed early economy creates a distinctive arc for player contracts:

- **Founding-era players** sign modest, short deals. Stars who outperform those
  deals gain disproportionate leverage when they expire — they are the first
  players in league history with proven track records, and the cap has grown
  since their original signing.
- **The first franchise-defining contract** becomes a genuine league milestone.
  When a Year 1 star re-signs for a deal that dwarfs anything previously seen,
  it resets the market and signals the league's economic maturation.
- **Expansion inflections create free-agency booms.** A cap jump from expansion
  gives every franchise more room, and the free-agent class that year commands
  richer deals than the class before it.

## Alternatives considered

- **Flat percentage growth (NFL-style).** A fixed annual cap increase (e.g. 5–8%
  per year) is simple and predictable. Rejected because it does not model the
  start-up-to-maturity arc that defines Zone Blitz's league-genesis identity. A
  flat rate makes Year 1 feel the same as Year 10 from a cap-planning
  perspective, erasing the distinctive scrappy-early-league feel.

- **Fully dynamic cap driven by simulated revenue and attendance.** Tie the cap
  directly to modeled league revenue — ticket sales, media deals, merchandise.
  Rejected as too complex and data-heavy for v1. It also couples the cap to
  systems (attendance simulation, media-deal negotiation) that may not exist at
  launch. The age-plus-expansion model captures the same narrative arc with far
  less mechanical overhead and can be extended to revenue-driven inputs later if
  desired.

## Consequences

- **The first several seasons have a distinctive "scrappy" feel.** Short deals,
  modest guarantees, and a tight cap mean roster construction rewards
  development and draft hits over free-agency spending sprees.
- **Stars from Year 1 gain disproportionate leverage.** The first wave of
  founding-era contract expirations (around seasons 3–4) is a narrative
  inflection point: proven players hit the market for the first time in a league
  that now has more cap room than when they signed.
- **Expansion introduces cap-growth inflection points.** Each expansion vote
  carries economic weight — voting yes means a larger cap for everyone, but also
  more competition for talent.
- **The "first franchise contract in league history" is a real milestone.**
  Media, record books, and league history should recognize when the first
  mega-deal is signed, because it marks the transition from start-up economics
  to a mature market.
- **Contract-toolkit restrictions in Year 1 reduce early-game complexity.** New
  players learn cap management with a simplified toolset before the full suite
  unlocks — a natural difficulty ramp.
- **Cap projections must account for non-linear growth.** The multi-year outlook
  tools described in salary-cap.md need to model the age-and-expansion curve,
  not just a flat percentage, when projecting future cap space.
