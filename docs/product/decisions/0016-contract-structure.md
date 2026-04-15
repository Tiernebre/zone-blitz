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
roster bonus, workout bonus, **per-game roster bonuses (PGRBs)**, **option
bonuses** (not counted until exercised; exercise creates a new proration slice),
per-year guarantee status (full / injury-only / none), void years, restructures
(as a pure transformation on the contract), and franchise tags (as a single-year
contract with a flag). v1 **defers** incentives (LTBE/NLTBE), rolling guarantee
vest dates, post-June-1 designations, and the fifth-year option. Each deferral
is called out explicitly in Consequences and the reasoning is that none of them
blocks the five ADRs this unblocks, and each adds meaningful schema and logic
surface that should land on its own PR with its own tests.

PGRBs and option bonuses are **in v1** specifically because they are the
primitives that make _gimmick contracts_ expressible — deals where the reported
headline dollars and the realistic cap hit diverge by 3x or more. Without them,
the schema can encode a clean deal but cannot encode the Cap-Hell archetype's
signature construction (see the Taysom Hill case study below).

### Contract components (v1)

| Component                    | Storage                                              | Cap treatment                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base salary                  | `contract_years.base`                                | Counts fully in that year                                                                                                                                                                                                                                                                                                           |
| Signing bonus                | `contracts.signingBonus`                             | Prorated evenly across `min(totalYears, 5)` years from signing year forward                                                                                                                                                                                                                                                         |
| Roster bonus                 | `contract_years.rosterBonus`                         | Counts fully in that year; voidable if player cut before the vest year                                                                                                                                                                                                                                                              |
| Workout bonus                | `contract_years.workoutBonus`                        | Counts fully in that year; voidable if cut in the offseason                                                                                                                                                                                                                                                                         |
| Per-game roster bonus (PGRB) | `contract_years.perGameRosterBonus`                  | Stored as the season max (17-game sum). Counts fully against the cap in that year as a **non-guaranteed** amount. Earned per game active; benches / injured-reserve stints reduce the actual payout. Cap-hit math treats it like a roster bonus; payout reconciliation is a separate system.                                        |
| Option bonus                 | `contract_bonus_prorations` with `source = 'option'` | **Not counted** in cap hit or headline value until the team exercises the option. On exercise, a new proration slice is inserted (`amount`, `firstYear` = exercise year, `years` ≤ 5) and it prorates identically to a signing bonus from that point forward. Unexercised options contribute nothing to cap, dead cap, or headline. |
| Guarantee status             | `contract_years.guaranteeType`                       | Enum: `full` / `injury` / `none` — determines whether base is voidable                                                                                                                                                                                                                                                              |
| Void year flag               | `contract_years.isVoid`                              | Year exists only to extend signing-bonus proration; no base/bonus paid                                                                                                                                                                                                                                                              |

Incentives (LTBE/NLTBE) and rolling guarantee vest dates are explicitly out of
v1 (see Follow-ups).

### Cap hit formula (pure)

```ts
// server/features/contracts/cap-hit.ts
function computeCapHit(contract: Contract, year: number): number {
  const yearRow = contract.years.find((y) => y.leagueYear === year);
  if (!yearRow) return 0;

  // Sum across all active proration slices: original signing bonus,
  // restructure slices, and any option bonuses that have been exercised.
  // Unexercised option bonuses are not present in this list.
  const proratedPortion = contract.bonusProrations
    .filter((p) => year >= p.firstYear && year < p.firstYear + p.years)
    .reduce((sum, p) => sum + Math.floor(p.amount / p.years), 0);

  if (yearRow.isVoid) return proratedPortion; // void years carry only proration

  // PGRB counts fully in the year from a cap-hit perspective (same bucket as
  // roster bonus); the per-game earn mechanic affects realized payout, not the
  // cap charge. A later ADR may refine this to project expected earn.
  return (
    yearRow.base +
    yearRow.rosterBonus +
    yearRow.workoutBonus +
    yearRow.perGameRosterBonus +
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
  // Accelerate every remaining slice of every active proration bucket —
  // original signing bonus, restructure slices, and any exercised option
  // bonuses. Unexercised options are not in this list and contribute nothing.
  const acceleratedBonus = contract.bonusProrations
    .map((p) => {
      const perYear = Math.floor(p.amount / p.years);
      const yearsRemaining = Math.max(0, p.firstYear + p.years - cutYear);
      return perYear * yearsRemaining;
    })
    .reduce((sum, v) => sum + v, 0);

  // PGRB is not guaranteed, so cutting the player eliminates it. Only
  // fully-guaranteed base and roster bonus survive as dead cap.
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

### Headline value formula (pure)

The cap sheet and the press release report different numbers. Media, morale, and
agent-narrative systems need the **reported** number — the "4 year / $140M"
figure a headline prints — not the cap hit. The gap between headline and
realistic cap hit is the gameplay signal that defines Cap Hell.

```ts
function computeHeadlineValue(contract: Contract): number {
  // Sum every dollar the deal could theoretically pay out, across every year,
  // assuming the most optimistic outcome: all PGRBs fully earned, all option
  // bonuses exercised, all void-year ghost amounts counted. Guaranteed status
  // is irrelevant — headline is optimistic by construction.
  const yearTotals = contract.years.reduce(
    (sum, y) =>
      sum +
      y.base +
      y.rosterBonus +
      y.workoutBonus +
      y.perGameRosterBonus, // assume 17-game maximum
    0,
  );

  // Every materialized proration bucket contributes its full face amount
  // (original signing bonus, restructure slices, already-exercised options).
  const materializedBonuses = contract.bonusProrations.reduce(
    (sum, p) => sum + p.amount,
    0,
  );

  // Plus every *declared-but-not-yet-exercised* option bonus, at its face
  // amount. This is how agents pitch the number: "we can earn up to X".
  const unexercisedOptionFace = contract.optionBonuses
    .filter((o) => o.exercisedAt === null)
    .reduce((sum, o) => sum + o.amount, 0);

  return yearTotals + materializedBonuses + unexercisedOptionFace;
}
```

Media and morale systems read `computeHeadlineValue`; cap sheets read
`computeCapHit`. **The divergence between the two is a feature, not a bug** — it
is the entire point of modeling gimmick deals. A Cap-Hell GM signs a "4 year /
$140M" headline that is really a 1-year / ~$10M cap reality; the fans expect a
superstar, the cap engine sees a rental, and the GM gets six months before the
press notices.

A **gimmick deal** is any contract where
`computeHeadlineValue(contract) / realGuaranteedValue(contract) > ~3x` (rough
heuristic). The concrete threshold and the media/morale behavior it triggers are
deferred to the media/morale ADR; this ADR only guarantees the primitives that
make the ratio computable.

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

### Case study: the Taysom Hill mega-deal (2021)

In 2021 the New Orleans Saints were in one of the deepest Cap Hells of the
modern era — over the cap by tens of millions before free agency opened. Taysom
Hill was a converted quarterback / utility player; useful, not a franchise
player. The Saints reported a **4-year, $140M** contract for him. Functionally,
it was a **1-year, ~$10M** deal dressed in dummy years stacked with
non-guaranteed per-game roster bonuses and option money that would void or never
be exercised. The headline pumped out a blockbuster story; the cap sheet
recorded a short-term rental. The gap between those two numbers is exactly what
this schema must be able to represent.

A plausible encoding (numbers approximate — the goal is to show the schema can
express the _shape_, not to match OTC line-for-line):

**`contracts` parent row**

| Field          | Value |
| -------------- | ----- |
| `signedYear`   | 2021  |
| `totalYears`   | 4     |
| `realYears`    | 1     |
| `signingBonus` | $0    |
| `isRookieDeal` | false |
| `tagType`      | null  |

**`contract_years` rows**

| `leagueYear` | `base`  | `rosterBonus` | `workoutBonus` | `perGameRosterBonus` | `guaranteeType` | `isVoid` |
| ------------ | ------- | ------------- | -------------- | -------------------- | --------------- | -------- |
| 2021         | $1.075M | $7.5M         | $0             | $1.5M                | `full`          | false    |
| 2022         | $0      | $0            | $0             | $0                   | `none`          | true     |
| 2023         | $0      | $0            | $0             | $0                   | `none`          | true     |
| 2024         | $0      | $0            | $0             | $0                   | `none`          | true     |

**`contract_bonus_prorations` rows**

_None at signing_ — there is no signing bonus in this encoding, so no proration
slice exists. (Restructure slices could be layered in later seasons if the
Saints chose to convert 2021 base or roster bonus into proration, which is
precisely how gimmick deals typically evolve.)

**`contract_option_bonuses`** (declared-but-not-yet-exercised)

| `exerciseYear` | `amount` | `prorationYears` | `exercisedAt` |
| -------------- | -------- | ---------------- | ------------- |
| 2022           | $95M     | 5                | null          |

The declared option is the bulk of the headline — a massive 2022 option the team
never intends to exercise and will let expire, collapsing the deal into its real
1-year shape.

**Function outputs on the 2021 row**

- `computeCapHit(contract, 2021)` ≈ **$10.075M** — base + roster bonus + PGRB +
  $0 in proration (no signing bonus exists to prorate). This is the number the
  cap sheet records: a one-year, ten-million-dollar rental.
- `computeHeadlineValue(contract)` ≈ **$140M** — sums 2021's $10.075M of real
  money, the void-year fields (all zero here but counted if populated), plus the
  full $95M face of the unexercised option plus any additional option
  declarations that together pad out the headline to the reported figure. This
  is the number the press release prints.
- `computeDeadCap(contract, 2022)` ≈ **$8.575M** — if the Saints had cut Hill
  after 2021, the remaining guaranteed full-guarantee base and roster bonus in
  later years would accelerate. With this specific encoding (only 2021 is
  guaranteed, no signing-bonus proration exists, voids carry nothing), dead cap
  is roughly the 2021-guaranteed-but-unpaid residue; in practice the Saints
  would have simply let the option expire. Swap in a more aggressive structure —
  say a $20M signing bonus prorated over five years — and the same cut would
  produce a much larger dead-cap number. The formula is the same either way; the
  generator's archetype parameter decides how painful it is.

If the schema couldn't represent this deal faithfully — the 14:1 ratio between
reported and real, the option that never fires, the voids that extend nothing
because no bonus was signed — v1 is too small.

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
  // Season max (sum across 17 games) of the per-game roster bonus. Non-
  // guaranteed. Used by `computeCapHit` and `computeHeadlineValue`.
  perGameRosterBonus: integer("per_game_roster_bonus").notNull().default(0),
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

**Option bonus lifecycle.** Option bonuses are _declared_ at signing but do not
produce a `contract_bonus_prorations` row until the team exercises them. The
eligible option (amount, exercise-year window, proration length) is stored on a
small `contract_option_bonuses` side table — one row per declared option, with
an `exercisedAt` timestamp that is null until exercised. On exercise, the system
writes a new `contract_bonus_prorations` row with `source = 'option'`,
`firstYear` set to the exercise year, and `years` set to the lesser of 5 or
remaining contract years. Until that proration row exists, `computeCapHit` sees
nothing from the option (correct cap treatment). `computeHeadlineValue`,
however, reads the declared-option face amount directly — headline is optimistic
by construction and assumes every option is exercised.

The `contract_option_bonuses` table is a thin
`{contractId, amount,
exerciseYear, prorationYears, exercisedAt}` shape; its
exact schema is finalized in the option-bonus implementation PR along with the
exercise flow and player-option variants.

`contract_history` (already exists) keeps its aggregate shape and is written at
termination; it is a read model for the player detail page per ADR 0013, not the
authoritative contract record.

## Alternatives considered

- **Keep the flat single-row shape and compute cap hits from `annualSalary`
  only.** Simple and already exists, but collapses base and signing bonus into a
  single number and therefore cannot produce the dead-cap-on-cut behavior the
  north-star is built around. Picking this shape means ADRs 0010/0011 are as far
  as the cap game ever goes. Rejected — this is the whole point of zone-blitz.
- **Fully NFL-accurate from day one** (LTBE/NLTBE incentives, rolling guarantee
  vest dates, post-June-1 designations, fifth-year option math). Correct long
  term, but each of those is its own testable mechanic and the unblocked ADRs
  (FA bidding, re-signing, cuts, tags, trades) do not depend on them. Rejected
  as v1 scope; each deferred item is a named follow-up ADR with its own schema
  extension. **Per-game roster bonuses and option bonuses were originally in
  this deferred list and have been promoted into v1** — they are the two
  primitives gimmick contracts require, and without them the schema cannot
  faithfully encode the deals the Cap-Hell archetype is built around (see the
  Taysom Hill case study).
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
  - Rolling guarantee vest dates (e.g. "Year 3 base guarantees on day 1 of Year
    2")
  - Fifth-year option mechanics for first-round rookie deals
  - Dynamic franchise/transition tag salary computation
  - Compensatory pick formula (uses the same contract data as an input)
  - Per-game roster bonus _payout reconciliation_ (the cap charge is v1; the
    game-by-game earn / unearn accounting that follows benchings and IR stints
    is a later refinement)
  - Media/morale "gimmick deal" detection threshold (consumes
    `computeHeadlineValue` from this ADR)
- **North-star coverage check.** The salary-cap north-star names option bonuses,
  per-game roster bonuses, incentives, and post-June-1 as part of the vision. v1
  delivers option bonuses and per-game roster bonuses (promoted for
  gimmick-contract modeling); incentives (LTBE/NLTBE), rolling guarantees, and
  post-June-1 remain deferred but the schema leaves room for each. This ADR adds
  a single subsection to the north-star — the Taysom Hill gimmick-contract case
  study — so future contributors do not lose the archetype.
- **NPC cap management** (salary-cap north-star §NPC Cap Management) now has a
  target shape to generate against. Win-Now and Gambler archetypes restructure
  aggressively; Developer archetypes structure cleanly. Those behaviors are
  personality-driven mutations on top of this schema, not separate models.
