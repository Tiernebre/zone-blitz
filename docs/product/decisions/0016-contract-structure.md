# 0016 — Contract structure: per-year breakdown with prorated signing bonus

- **Date:** 2026-04-15
- **Status:** Proposed
- **Area:** salary cap, free agency — builds on
  [`../north-star/salary-cap.md`](../north-star/salary-cap.md) and
  [`../north-star/free-agency-and-contracts.md`](../north-star/free-agency-and-contracts.md);
  extends [`0010-league-cap-situations.md`](./0010-league-cap-situations.md) and
  [`0011-positional-market-value.md`](./0011-positional-market-value.md).

## Context

ADRs 0010 and 0011 decided the _totals_ of a contract — how much a team owes in
aggregate, and how that number varies by position and cap archetype. Neither
decided the _anatomy_: how those totals distribute across years, what portion is
guaranteed, how much is signing bonus versus base, and therefore what a cut or
restructure actually costs. Today's `contracts` table
(`server/features/contracts/contract.schema.ts`) stores only flat aggregates —
`totalYears`, `totalSalary`, `annualSalary`, `guaranteedMoney`, `signingBonus` —
with no per-year structure. That is enough to place a player on a roster and
nothing more. It cannot model a cap hit, a dead-cap spike, a post-June-1 cut, a
restructure, or a void year.

Every subsequent cap system — free-agency bidding, re-signing, extensions, cuts,
franchise tags, trade cap math — depends on `computeCapHit(contract,
year)` and
`computeDeadCap(contract, cutYear)` being real functions of a real data model.
That is what this ADR defines.

The north-star
([`salary-cap.md`](../north-star/salary-cap.md#contract-structure)) already
names the components we need (base salary, signing bonus proration, guarantees,
roster bonuses, void years, restructures, post-June-1). This ADR is the
implementation shape of that vision.

## Decision

Replace the flat `contracts` table with a **parent `contracts` row plus a
`contract_years` child table — one row per league year of the deal, including
void years**. The parent carries deal-wide facts (signed date, length including
voids, proration cap, signing bonus total, tag metadata); the child carries
everything that varies year to year (base, roster bonus, workout bonus,
guarantee status). Signing bonus is stored as a single total on the parent and
**prorated at read time** by the cap-hit function — never denormalized onto
years. Dead cap is a pure function of the same rows.

v1 models: base salary, signing bonus (5-year max proration, per NFL rules),
roster bonus, workout bonus, per-year guarantee status (full / injury-only /
none), void years, restructures (as a pure transformation on the contract), and
franchise tags (as a single-year contract with a flag). v1 **defers** option
bonuses, incentives (LTBE/NLTBE), per-game roster bonuses, rolling guarantee
vest dates, and post-June-1 designations. Each deferral is called out explicitly
in Consequences and the reasoning is that none of them blocks the five ADRs this
unblocks, and each adds meaningful schema and logic surface that should land on
its own PR with its own tests.

### Contract components (v1)

| Component        | Storage                        | Cap treatment                                                               |
| ---------------- | ------------------------------ | --------------------------------------------------------------------------- |
| Base salary      | `contract_years.base`          | Counts fully in that year                                                   |
| Signing bonus    | `contracts.signingBonus`       | Prorated evenly across `min(totalYears, 5)` years from signing year forward |
| Roster bonus     | `contract_years.rosterBonus`   | Counts fully in that year; voidable if player cut before the vest year      |
| Workout bonus    | `contract_years.workoutBonus`  | Counts fully in that year; voidable if cut in the offseason                 |
| Guarantee status | `contract_years.guaranteeType` | Enum: `full` / `injury` / `none` — determines whether base is voidable      |
| Void year flag   | `contract_years.isVoid`        | Year exists only to extend signing-bonus proration; no base/bonus paid      |

Options, incentives, per-game bonuses, and rolling guarantee vest dates are
explicitly out of v1 (see Follow-ups).

### Cap hit formula (pure)

```ts
// server/features/contracts/cap-hit.ts
function computeCapHit(contract: Contract, year: number): number {
  const yearRow = contract.years.find((y) => y.leagueYear === year);
  if (!yearRow) return 0;

  const prorationYears = Math.min(contract.totalYears, 5);
  const signingBonusProration = Math.floor(
    contract.signingBonus / prorationYears,
  );
  const inProrationWindow = year >= contract.signedYear &&
    year < contract.signedYear + prorationYears;

  const proratedPortion = inProrationWindow ? signingBonusProration : 0;
  if (yearRow.isVoid) return proratedPortion; // void years carry only proration

  return (
    yearRow.base +
    yearRow.rosterBonus +
    yearRow.workoutBonus +
    proratedPortion
  );
}
```

Integer cents / dollars throughout (no floats in the cap). Rounding residue from
proration is placed on the final proration year so sums reconcile exactly to the
signing-bonus total.

### Dead cap formula (pure)

```ts
function computeDeadCap(contract: Contract, cutYear: number): number {
  const prorationYears = Math.min(contract.totalYears, 5);
  const signingBonusProration = Math.floor(
    contract.signingBonus / prorationYears,
  );
  const yearsOfProrationRemaining = Math.max(
    0,
    contract.signedYear + prorationYears - cutYear,
  );
  const acceleratedBonus = signingBonusProration * yearsOfProrationRemaining;

  const remainingGuaranteedBase = contract.years
    .filter((y) => y.leagueYear >= cutYear && y.guaranteeType === "full")
    .reduce((sum, y) => sum + y.base + y.rosterBonus, 0);

  return acceleratedBonus + remainingGuaranteedBase;
}
```

Post-June-1 designation is **not modeled in v1** — every cut accelerates all
remaining proration immediately. Reason: post-June-1 is a cap-smoothing tool
that meaningfully changes outcomes only once cut/restructure flows exist and the
user is actually managing a multi-year cap sheet. Shipping it before those flows
exist is solving a problem no one can feel yet. Filed as a follow-up; see
Consequences.

### Restructure as pure transformation

A restructure does not mutate salary totals — it rebalances how that money is
classified.

```ts
function restructureContract(
  contract: Contract,
  year: number,
  amount: number, // base dollars to convert into signing bonus
): Contract {
  // 1. Reduce base in `year` by `amount`
  // 2. Increase signingBonus by `amount`
  // 3. Re-prorate across remaining contract years (capped at 5)
  //    NB: the new proration window starts at `year`, not `signedYear` —
  //    restructures create a fresh proration slice on top of the existing one.
  //    Store each restructure as its own row in `contract_bonus_prorations`
  //    rather than mutating `signingBonus`, so dead-cap math sums all active
  //    prorations at cut time.
}
```

Two bonus proration buckets — original signing bonus plus any restructure
bonuses — are tracked in a small `contract_bonus_prorations` child table keyed
by contract, with `amount`, `firstYear`, and `years`. The cap-hit and dead-cap
functions sum across buckets. This is the single edge that is worth the extra
table: modeling restructures as a mutation of `signingBonus` loses the
proration-start-year, which is the whole point.

### Void years

Modeled in v1 as `contract_years` rows with `isVoid = true`. They carry
signing-bonus proration only; they generate no base, roster, or workout amounts.
When the last real year ends, all remaining proration on void years accelerates
as dead cap (same formula, same function). This is cheap to model — it is one
boolean and one branch in `computeCapHit` — and without it the Cap Hell
archetype loses its most identifiable gameplay lever.

### Rookie contracts

Same schema, flagged on the parent (`isRookieDeal: boolean`, `rookieDraftPick`
nullable). The slotted rookie wage scale produces the per-year rows at draft
time. Fifth-year option is a separate follow-up ADR — v1 rookie deals are 4
years flat. Keeping rookie deals in the same table means the cap-hit and
dead-cap functions do not branch on contract type; a cap is a cap.

### Franchise / transition tag

Modeled as a one-year `contracts` row with
`tagType: 'franchise' | 'transition'
| null`. Base salary is populated by the
top-5-positional-average calculation at tag time. No signing bonus, no
proration. Tagging is a contract generator, not a new data shape. This keeps
trade cap math, cut math, and cap-hit math uniform across tagged and non-tagged
players.

### Relationship to ADR 0010 and ADR 0011

Generation flow at league creation is:

1. ADR 0010 picks each team's cap archetype and target committed-cap band.
2. ADR 0011 supplies each player's positional market value for their overall/age
   slot — the **total contract value**.
3. This ADR decides the **shape** of that total: years, split between base and
   signing bonus, guarantee pattern, and any void years. The generator produces
   a deterministic structure conditioned on (a) total value, (b) the team's
   archetype, and (c) the position's market convexity from 0011.

Concretely: Cap Hell teams generate with higher signing-bonus ratios and more
void years (that is how they got into Cap Hell); Flush teams generate with lower
bonus ratios and cleaner structures (that is how they stay Flush); Balanced
teams generate with NFL-median structures. The archetype is a parameter to the
contract-shape generator, not a post-hoc adjustment.

### Determinism

The contract-shape generator consumes the same injected `random` factory
threaded through ADRs 0009 / 0010 / 0011. All integer arithmetic; no floats.
Proration rounding is deterministic (residue on last year). Tests assert (a)
`sum(computeCapHit(contract, y) for y in contract years) == totalContractValue`
and (b)
`computeDeadCap(contract, cutYear) + sum(remaining cap hits past cut)
== committed total at cut time`
— these are the two invariants that catch almost every cap bug.

## Schema sketch

```ts
// server/features/contracts/contract.schema.ts (supersedes existing flat shape)
export const contracts = pgTable("contracts", {
  id: uuid("id").defaultRandom().primaryKey(),
  playerId: uuid("player_id").notNull().references(() => players.id, {
    onDelete: "cascade",
  }),
  teamId: uuid("team_id").notNull().references(() => teams.id, {
    onDelete: "cascade",
  }),
  signedYear: integer("signed_year").notNull(),
  totalYears: integer("total_years").notNull(), // includes void years
  realYears: integer("real_years").notNull(), // excludes void years
  signingBonus: integer("signing_bonus").notNull().default(0),
  isRookieDeal: boolean("is_rookie_deal").notNull().default(false),
  rookieDraftPick: integer("rookie_draft_pick"),
  tagType: pgEnum("contract_tag_type", ["franchise", "transition"])("tag_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contractYears = pgTable("contract_years", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractId: uuid("contract_id").notNull().references(() => contracts.id, {
    onDelete: "cascade",
  }),
  leagueYear: integer("league_year").notNull(),
  base: integer("base").notNull().default(0),
  rosterBonus: integer("roster_bonus").notNull().default(0),
  workoutBonus: integer("workout_bonus").notNull().default(0),
  guaranteeType: pgEnum("contract_guarantee_type", [
    "full",
    "injury",
    "none",
  ])("guarantee_type").notNull().default("none"),
  isVoid: boolean("is_void").notNull().default(false),
});

export const contractBonusProrations = pgTable("contract_bonus_prorations", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractId: uuid("contract_id").notNull().references(() => contracts.id, {
    onDelete: "cascade",
  }),
  amount: integer("amount").notNull(),
  firstYear: integer("first_year").notNull(),
  years: integer("years").notNull(), // 1..5
  source: pgEnum("contract_bonus_source", ["signing", "restructure", "option"])(
    "source",
  ).notNull(),
});
```

`contract_history` (already exists) keeps its aggregate shape and is written at
termination; it is a read model for the player detail page per ADR 0013, not the
authoritative contract record.

## Alternatives considered

- **Keep the flat single-row shape and compute cap hits from `annualSalary`
  only.** Simple and already exists, but collapses base and signing bonus into a
  single number and therefore cannot produce the dead-cap-on-cut behavior the
  north-star is built around. Picking this shape means ADRs 0010/0011 are as far
  as the cap game ever goes. Rejected — this is the whole point of zone-blitz.
- **Fully NFL-accurate from day one** (option bonuses, LTBE/NLTBE incentives,
  rolling guarantee vest dates, per-game roster bonuses, post-June-1
  designations, fifth-year option math). Correct long term, but each of those is
  its own testable mechanic and the unblocked ADRs (FA bidding, re-signing,
  cuts, tags, trades) need only the components this ADR defines. Rejected as v1
  scope; each deferred item is a named follow-up ADR with its own schema
  extension.
- **Single JSONB `structure` blob on the contract row** instead of a child
  table. Flexible, no migrations for new fields. Rejected for the same reason
  ADR 0007 rejected JSONB tendencies: queries like "show me every contract with
  guaranteed money remaining in year 3" become awkward, type safety erodes, and
  the cap engine's hottest code path (per-year iteration) becomes JSON parsing.
  A child table is ~40 lines of schema and makes every cap query a plain SQL
  join.
- **Denormalize the prorated signing bonus onto each `contract_years` row at
  write time.** Tempting — makes `computeCapHit` a one-row lookup. Rejected
  because restructures, rookie renegotiations, and void-year mutations would
  have to rewrite every year row transactionally; storing a single signing bonus
  and prorating on read is both simpler and the standard cap-site model (OTC,
  Spotrac). The per-year cap hit is two additions and one divide — there is no
  perf case to make.
- **Store each restructure as a full contract supersession** (close the old row,
  open a new row). Rejected — it destroys contract identity for morale,
  compensatory-pick, and transaction-history purposes (ADR 0013 expects one
  contract across its life). Keeping the contract stable and layering bonus
  prorations on top preserves the "this is Mahomes's 10-year deal" narrative the
  UI surfaces.

## Consequences

- **Supersedes** the current flat `contracts` table shape. A migration replaces
  `totalSalary`, `annualSalary`, `guaranteedMoney`, and `currentYear` with the
  parent + child + bonus-prorations structure. The generator work from ADRs
  0009/0010/0011 must be updated to emit per-year rows; the uniform-scale step
  continues to operate on totals, then the shape generator distributes them.
  `contract_history` is untouched — it remains the aggregate read model.
- **Unblocks** these ADRs, each of which depends on `computeCapHit` /
  `computeDeadCap` existing as pure functions:
  - Free-agency bidding (offers are evaluated against cap hit, not annual
    salary)
  - Re-signing flow (structure the new deal, project future cap)
  - Cuts with dead cap
  - Franchise tag mechanics (a one-year `contracts` row with `tagType`)
  - Trade cap math (outgoing dead cap + incoming remaining cap hits)
  - Extensions (append years, add a new bonus proration bucket)
- **Makes it easy to write cap-invariant tests.** The two invariants in the
  Determinism section are the cap engine's smoke alarms — they will catch any
  generator or mutation bug before it ships.
- **Explicit follow-ups (own ADRs / Issues):**
  - Post-June-1 designations (deferred from v1 dead-cap formula)
  - Incentives: LTBE vs. NLTBE, with next-year cap carryover
  - Option bonuses (team/player) with their own proration
  - Per-game roster bonuses
  - Rolling guarantee vest dates (e.g. "Year 3 base guarantees on day 1 of Year
    2")
  - Fifth-year option mechanics for first-round rookie deals
  - Dynamic franchise/transition tag salary computation
  - Compensatory pick formula (uses the same contract data as an input)
- **North-star coverage check.** The salary-cap north-star names option bonuses,
  incentives, and post-June-1 as part of the vision; v1 does not deliver them
  but the schema leaves room (see `contract_bonus_prorations.source` already
  supporting `option`, and the guarantee enum extensible to rolling types). This
  ADR does not modify the north-star.
- **NPC cap management** (salary-cap north-star §NPC Cap Management) now has a
  target shape to generate against. Win-Now and Gambler archetypes restructure
  aggressively; Developer archetypes structure cleanly. Those behaviors are
  personality-driven mutations on top of this schema, not separate models.
