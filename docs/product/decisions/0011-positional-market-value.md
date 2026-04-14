# 0011 — Positional market value

- **Date:** 2026-04-14
- **Status:** Accepted — refines the position-tier list in
  [`0009-archetype-aware-player-generator.md`](./0009-archetype-aware-player-generator.md)
  and feeds into
  [`0010-league-cap-situations.md`](./0010-league-cap-situations.md).
- **Area:** salary cap, free agency — builds on
  [`salary-cap.md`](../north-star/salary-cap.md) and
  [`free-agency-and-contracts.md`](../north-star/free-agency-and-contracts.md).

## Context

ADR 0009 bucketed positions into three tiers (premium / mid / base) for the stub
contract generator. That was enough to avoid a literal even split, but it
smooths out the thing that actually defines the NFL's financial shape: a
quarterback gets a different _kind_ of contract than a guard, not just a bigger
one on the same curve. An 85-overall QB is a generational-level payday; an
85-overall RB is still on a second contract the market grumbles about.

This matters in two places, which is why it gets its own decision rather than
living inside ADR 0009:

1. **League generation.** Cap-situation archetypes (ADR 0010) need to land in
   their committed-cap bands using realistic inputs. If every position pays on
   the same curve, a Cap Hell team is implausibly RB-heavy and a Flush team has
   no star QB.
2. **Free agency negotiations (future work).** Offers are evaluated against a
   market value the player and their agent believe they deserve. That market
   value is _positional_, not just a function of overall rating — a 90-overall
   RB will not accept a 90-overall QB's offer because no other team will match
   it either.

## Decision

Introduce a **positional market multiplier** as a first-class, tunable table,
consumed by both the contract generator (ADR 0009) and the future free-agency
valuation code. It replaces the three-tier bucket from ADR 0009.

### Market multipliers

Multipliers are applied to a quality-driven base salary. Higher multiplier =
richer market. Initial table (tunable; tests assert the ordering, not the exact
numbers):

| Position | Multiplier | Rationale                                               |
| -------- | ---------- | ------------------------------------------------------- |
| QB       | 1.80       | Franchise-defining, scarce, drives everything           |
| EDGE     | 1.45       | Pass-rush is the second-most-leveraged skill            |
| OT       | 1.30       | Blindside protection; scarcity                          |
| WR       | 1.25       | Top of market has crept up; #1s get paid                |
| CB       | 1.20       | Premium coverage, though behind WR historically         |
| IDL      | 1.10       | Interior disruption; healthy market for top tier        |
| S        | 1.00       | Baseline — solid market, not a premium                  |
| TE       | 0.95       | Top TEs approach WR money; middle of market is thin     |
| LB       | 0.90       | Off-ball LB market has been suppressed                  |
| IOL      | 0.85       | Guards/centers paid less than tackles                   |
| RB       | 0.65       | Depressed market; short shelf life, high replaceability |
| K        | 0.25       | Specialist, minimum-adjacent                            |
| P        | 0.25       | Specialist, minimum-adjacent                            |
| LS       | 0.20       | Specialist, minimum-adjacent                            |

The QB-to-RB spread is the point: an 85-overall QB should come out of the
generator at roughly **~2.75×** what an 85-overall RB does (1.80 / 0.65). That
is approximately the live-NFL gap and is the headline invariant the tests pin.

### Top-of-market skew

A flat multiplier is not enough. Elite-tier quality at a premium position gets
an _additional_ skew: the market pays the top QB far more than it pays the
tenth-best QB, more than the analogous gap at IOL. Concretely, the per-player
quality-to-salary curve is **convex at premium positions and flatter at
depressed positions** — top QBs explode off the top of the curve, RBs plateau.
This is a per-position curve shape, not a separate table, so it lives next to
the multiplier.

### Rookie contracts are exempt

Rookie-scale deals come from the slotted rookie wage scale (salary-cap
north-star), not this table. The market multiplier only applies to
second-contract and later deals. This is why a Flush team leaning on a
rookie-contract QB is cheap: the market is expensive, but the rookie scale
overrides it for four or five years.

### Free-agency valuation (forward-looking)

When the FA loop lands, player/agent minimum-acceptable offers are computed from
the same table. A player will reject an offer below their positional market
value (modulo personality, loyalty, team situation — those get their own
decision). This is why this table is not an internal helper of the contract
generator: it is the canonical "what is a player worth" source.

### Where the table lives

One module, exported as a constant map (position → multiplier + curve
parameters). Consumers:

- `createStubPlayersGenerator` (ADR 0009) — replaces the tier buckets.
- Cap-situation archetype sampler (ADR 0010) — influences which positions a Cap
  Hell team is likely to have stars at (premium-market positions concentrate
  cap; RB-heavy rosters literally cannot reach the Cap Hell band).
- Future FA valuation — same import.

Because it is the single source, tuning the market is one edit. That is the
whole point.

## Alternatives considered

- **Keep the three-tier premium/mid/base buckets and tune them harder.** Tiers
  collapse positions that have different markets (WR ≠ CB, LB ≠ TE, RB ≠ the
  rest of "mid"). The RB depression specifically is invisible in a tiered model
  — RB belongs in its own bucket or the model is wrong.
- **Derive market from simulation (let prices emerge from supply/demand each
  offseason).** Long-term, maybe. For now we need deterministic generation at
  league creation; a seeded table gives us that and is a reasonable starting
  point for the eventual dynamic market.
- **Hard-code RB to a flat cap.** Too blunt — a generational RB should still get
  paid, just less than a generational QB. The convex-curve-per-position approach
  handles the Saquon / McCaffrey case without a special rule.
- **Separate "cap value" and "FA value" tables.** They are the same thing. If
  the generator and the FA loop disagree on what a QB is worth, the league
  becomes incoherent the moment a contract expires.

## Consequences

- ADR 0009's `tier` field on the contract generator is superseded. The generator
  now takes the market table as a dependency (default import, overridable for
  tests).
- Cap-situation archetypes (ADR 0010) become reachable in a realistic way — Cap
  Hell teams naturally have premium-position stars driving the committed cap,
  Flush teams can be light at premium positions or on rookie deals.
- RB-heavy rosters are structurally cheaper. This is correct and is a thing the
  user will feel when they pick an RB-heavy team and see "Flush" on the badge.
- The table is a knob, not a law. When the live NFL market shifts (IOL is
  catching up to OT, TE is approaching WR money), we edit one file and both
  generation and FA re-price together.
- Future work — positional scarcity inside a single league's FA class should
  _further_ modulate these multipliers (a thin QB class pays even more; a loaded
  RB class pays even less). Out of scope here; this ADR establishes the static
  baseline.
