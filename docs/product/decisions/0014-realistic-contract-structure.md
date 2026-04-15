# 0014 — Realistic contract structure

- **Date:** 2026-04-14
- **Status:** Accepted — extends
  [`0009-archetype-aware-player-generator.md`](./0009-archetype-aware-player-generator.md),
  [`0010-league-cap-situations.md`](./0010-league-cap-situations.md), and
  [`0011-positional-market-value.md`](./0011-positional-market-value.md).
- **Area:** salary cap, contracts — builds on
  [`salary-cap.md`](../north-star/salary-cap.md) and
  [`free-agency-and-contracts.md`](../north-star/free-agency-and-contracts.md).

## Context

ADRs 0009–0011 produce one number per player: a cap hit derived from quality,
position multiplier, and archetype band. That number is legible enough to paint
a league's cap landscape, but it is not a contract — it cannot be restructured,
cannot carry dead cap, cannot distinguish a $30M fully-guaranteed deal from a
$30M deal the team can walk away from after one year. Every mechanic the
salary-cap north-star promises (restructures, void years, post-June 1, dead cap,
guarantees vesting, cap hell consequences) requires the contract to have
internal structure.

A common misconception worth pinning down up front: **the NFL is a hard-cap
league only.** No soft cap, no luxury tax, no exceptions — that is the NBA and
MLB respectively. Our north-star already reflects this; this ADR does not
re-litigate it. What the NFL _does_ have, and what this ADR formalizes in our
model, is:

- A single **hard cap** ceiling.
- A **salary floor** (minimum team spend, enforced over a rolling multi-year
  window in real life; we model it per-league-year for clarity).
- **Compliance deadlines** — teams can be over the cap in the offseason but must
  be compliant by the start of the league year.
- Contracts with multiple accounting components — base salary, signing bonus
  (prorated), roster/option bonuses, guarantees that can be fully guaranteed,
  injury-only, or roll to fully guaranteed on a date.

The ADR-0009 single-number contract is the blocker. Until a contract knows its
own signing-bonus proration and guarantee schedule, restructures and dead cap
cannot be implemented and the generator cannot produce the kind of cap
situations the north-star describes ("cap hell with $40M in dead cap from a
restructured star").

## Decision

Replace the single `capHit` field on a generated contract with a **structured
contract record** that captures the components the NFL actually uses: base
salary per year, signing bonus with proration, roster bonuses, and a per-year
guarantee schedule. The cap-hit number every existing consumer reads becomes a
_derived_ view over that structure.

### Contract record shape

A contract is a sequence of **contract years** plus contract-level metadata.

Contract-level:

- `signingBonus` — lump sum paid at signing. Prorated equally across the
  contract's real years, capped at 5 years of proration (void years extend the
  proration window, see below).
- `voidYears` — count of phantom years appended solely to stretch proration. The
  player does not play in these years; when they activate, remaining prorated
  bonus accelerates as dead cap.
- `guaranteeMechanics` — per-year guarantee type (`fully`, `injury-only`,
  `rolling`) and, for rolling guarantees, the vest date.

Per-year:

- `baseSalary` — counts fully against the cap in that year.
- `rosterBonus` — optional; paid and cap-charged on a specified date if the
  player is on the roster.
- `optionBonus` — optional; team-exercised bonus that, if exercised, prorates
  like a signing bonus across remaining years.
- `incentives` — split into LTBE (counts this year) and NLTBE (counts next year
  if earned). See the north-star for the distinction.

### Cap hit is a derivation, not a field

`capHitForYear(contract, year)` = `baseSalary` + proration slice of
`signingBonus` + any `rosterBonus` + active `optionBonus` proration + LTBE
incentives + previous-year NLTBE that earned out. This is the only place cap hit
is computed; no caller stores it.

Dead-cap-on-cut and dead-cap-on-trade are similar pure functions over the
contract. Post-June 1 treatment is a flag on the cut event that changes how the
function splits acceleration across the current and next year.

### Guaranteed vs. unguaranteed money

Each dollar on the contract is one of:

- **Fully guaranteed at signing** — paid regardless. Guaranteed money cannot be
  recovered by cutting; it becomes dead cap.
- **Injury-guaranteed only** — paid if the player is injured; voided if cut
  healthy. In practice this becomes "protection for the player, escape hatch for
  the team" in later contract years.
- **Rolling guarantee** — unguaranteed at signing, converts to fully guaranteed
  on a specified league date. This is the mechanism behind "Year 3 base
  guarantees on the 3rd league day of Year 2" and is what creates the decision
  points the north-star calls out.

Guarantee totals are a first-class query on the contract
(`fullyGuaranteedAt(contract, date)`) because that is the number agents and
players evaluate offers against, not the headline total.

### Generator output at league creation

The ADR-0009 / 0010 / 0011 generator now emits structured contracts. The
archetype bands from ADR 0010 remain the authoritative committed-cap target, but
reaching those bands now happens by shaping contract _structure_, not just
dollar totals:

- **Cap hell** teams disproportionately have restructured-looking contracts:
  large prorated signing bonuses stretched over 4–5 years, with heavy guarantees
  in the near years. This naturally produces the "inherited dead cap liability"
  feel — if the user cuts a star to clear space, the bill is real.
- **Flush** teams skew toward rookie-scale deals (ADR-0009 rookie contracts,
  untouched by this ADR's market mechanics) and short, low-guarantee veteran
  deals.
- Star-tier veterans at premium positions (per ADR 0011) get convex structures —
  big signing bonus, high early guarantees. Base/depressed-market players get
  flatter structures with more non-guaranteed later years.

The generator is seeded from the same injected `random` as before; determinism
is preserved.

### Salary floor

The salary floor is modeled as a per-team, per-league-year minimum cash spend
(base salary + signing bonus + bonuses actually paid that year). Teams under the
floor at the compliance deadline owe the difference to their players, as in the
north-star. Floor enforcement is its own follow-up implementation; this ADR
establishes the data model it needs (cash-spend is derivable from the structured
contract) and commits to the floor being a hard rule, not a soft target.

### What is explicitly _not_ in scope

- **Soft-cap / luxury-tax mechanics** — the NFL does not have these, and neither
  does this game. The north-star is the source of truth on this.
- **Restructure / extension / post-June 1 UI flows.** The data model here
  supports them; the flows themselves are follow-up work.
- **Free-agency negotiation.** Guarantee expectations and positional market
  (ADR 0011) inform FA offers, but the FA loop is its own decision.
- **Cap growth year-over-year.** Already in the north-star, unchanged by this
  ADR.

## Alternatives considered

- **Keep a single `capHit` number and bolt on side tables for bonuses and
  guarantees.** Rejected: the side-table approach makes every query
  (`capHitForYear`, `deadCapIfCut`, `fullyGuaranteedAt`) a join across
  disconnected state and guarantees drift between them. The contract is a unit;
  model it as one.
- **Model a soft cap anyway, to offer a "lenient mode."** Rejected: it
  contradicts the north-star's central design pillar ("Every roster decision
  runs through the cap"). The thrill of cap hell only exists because the cap is
  hard. A lenient mode would be a different game.
- **Per-dollar guarantee tagging instead of per-year guarantee schedules.**
  Overkill — real NFL contracts guarantee salary in whole-year chunks (with
  rolling dates), not dollar-by-dollar. Matching the real mechanic keeps the
  model legible and the edge cases tractable.
- **Defer this until the restructure flow is designed.** Tempting, but the
  generator blocks on it first: ADR 0010's Cap Hell archetype cannot be
  populated realistically without structured contracts, because "cap hell" _is_
  prorated-bonus-driven. Building the data model first unblocks generation and
  the flows together.
- **Use a third-party NFL contract data model (e.g., OverTheCap's schema).**
  Attractive but overfit to real-player-name records with historical amendments.
  Our generator produces synthetic contracts from scratch; we want the minimum
  faithful model, not an import-compatible one.

## Consequences

- ADR 0009's `capHit` field on generated contracts is superseded by a structured
  record. Every consumer reading `capHit` today must switch to
  `capHitForYear(contract, currentYear)`. This is a single round of updates
  across the generator, the team-total calculation in ADR 0010, and any UI that
  currently surfaces cap hit.
- ADR 0010's archetype bands are now reachable with realistic structure. Cap
  Hell stops being "big numbers" and becomes "big prorated bonuses + heavy
  near-year guarantees," which is what Cap Hell actually feels like.
- Dead cap becomes real. Cutting a generated star is no longer free; the
  inherited cap situation has teeth. This is the whole point and also the
  biggest UX consequence — the cap page and any cut/trade confirmations must
  surface dead-cap impact before the user commits.
- The restructure, extension, and post-June 1 flows can now be built on a stable
  substrate. Each is its own follow-up; this ADR does not design them.
- The salary floor is now a computable quantity at league creation. We should
  assert in tests that no generated team lands below the floor (and if archetype
  bands would push a team there, the generator must lift them to floor
  compliance, not generate an illegal team).
- The generator output is larger per player. Not a performance concern at 32
  teams × ~60 roster spots, but the seeded-test fixtures will need to be
  regenerated; this is a one-time cost at the ADR's implementation PR.
- Follow-up issues to file on acceptance:
  - Contract data model and `capHitForYear` / `deadCapIfCut` /
    `fullyGuaranteedAt` pure functions.
  - Generator migration from ADR-0009 single-number contracts to structured
    contracts, preserving ADR-0010 archetype bands and ADR-0011 market
    multipliers.
  - Salary floor enforcement at league creation and at compliance deadlines.
  - Cap page + cut/trade confirmation surfaces that read dead cap and guarantee
    totals from the structured contract.
