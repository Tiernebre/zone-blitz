# Staff Market + Counter-Offers — Proposal

Status: draft, review round 1 applied.

Extends the existing head-coach hiring flow (`src/main/java/app/zoneblitz/league/hiring/`) with two intertwined mechanics: **a staff salary budget per team** and **candidate-driven counter-offers** when a preferred team is close but not winning the bidding. Ties directly to the charter's economy-simulator framing — the budget is the scarce resource, candidate preferences create the bidding tension.

## Motivation

Today: every team can make any offer; `PreferenceScoringOfferResolver` picks the candidate's top-scoring active offer on the day tick; user and CPU compete on terms + fit with no economic ceiling and no second chances.

Gaps:

1. **No scarcity.** Offers have no cost beyond narrative. The GM seat doesn't feel like an economy.
2. **No drama at the margin.** A candidate who slightly prefers the user's team but gets a richer CPU offer just signs with the CPU — silently. Real hires haggle; the preferred team gets a chance to match.
3. **No hiring-strategy tradeoffs.** Without a cap, "star HC + elite coordinators + elite scouts" is always correct. A budget forces the GM to pick a shape.

## Scope

In:
- Staff salary budget per team (equal across all 8 teams in v1), enforced at offer time.
- Candidate counter-offer flow for head coach hiring, driven by preference-score margin, resolved via day ticks.
- Variable quality across **all staff roles** — HC, coordinators, position coaches, scouts — so the budget drives real tradeoffs.

Out (v1):
- Tiered or owner-driven budgets. Every team gets the same pool.
- Real-time negotiation UI. Everything resolves on the phase-day tick.
- Multi-round counter-offers. One round, match-or-walk.
- Franchise tags for staff.
- Signing bonuses / proration on staff contracts (flat APY + guarantees only).

## Design

### 1. Staff budget

Drives the whole economy.

**Sizing.** Modern NFL staffs total ~$25–30M/team (HC ~$7M avg, OC/DC ~$2–3M, STC ~$1.5M, 10 position coaches ~$1M each, QC ~$150k). League doesn't publish totals; this is reconstructed from leaked individual salaries. See research notes in the conversation that spawned this proposal.

Zone Blitz is a fictional spring league, so: keep the *structure* (HC dominates, coordinators next, position coaches, QC), pick a fictional *magnitude* that creates meaningful tradeoffs. Starting number: **$25M/team**, tunable in data.

**Data.** New band file `data/bands/staff-market.json` with per-role salary distributions (min / p25 / median / p75 / max) for each role the sim hires:
- Head coach
- Offensive coordinator, defensive coordinator, special teams coordinator
- Position coaches (QB, RB, WR/TE, OL, DL, LB, DB, ST asst)
- Quality control / analysts
- Director of scouting
- Area scouts

Role-median × expected count ≈ team budget. Setting median salaries is how the designer tunes the economy without touching code.

**Schema.** One new column on `team`:
- `staff_budget_cents BIGINT NOT NULL` — populated from league config at league creation. Same value for every team in v1.

Stored on the team row (not the league row) so future variants (expansion, owner investment, penalty deductions) slot in without a schema change.

**Committed budget is derived, not stored.** Review round 1: don't keep a running `staff_committed_cents` counter — it drifts. Instead, compute committed dollars by summing the team's current contractual obligations:

```
committed(team, season) =
    Σ apy_cents for signed staff contracts where season ∈ [start_season, end_season]
  + Σ apy_cents for pending offers in ACTIVE or COUNTER_PENDING status
  + Σ dead_cap_cents for terminated contracts with remaining guarantees in this season
```

Contracts are the source of truth; committed dollars fall out of them. Exposed as a view or a repository method (`StaffBudgetRepository#committed(teamId, season)`), not a column.

**Caching.** If the query gets expensive, cache per-season and invalidate on:
- offer status change
- new hire signed
- contract terminated (firing / retirement)
- season rollover

For v1, start uncached and measure. A team has O(30) staff contracts max — this is a cheap aggregate.

**Enforcement.** `MakeOffer` rejects offers where `committed(team, currentSeason) + offer.apy > team.staff_budget`. New `MakeOfferResult.InsufficientBudget` variant. Counter-offers go through the same check — a preferred team that can't match just can't counter.

**Contracts are multi-year; budget is not reset annually.** Staff contracts have a term (years), an APY, and a guarantee amount. Each season, the APY of every still-active contract counts against that season's budget. Consequences:

- Hiring a $10M/yr HC on a 5-year deal locks $10M of every future season's cap until year 6 or a buyout.
- Assistant coaches and scouts typically sign shorter deals (1–2 yrs) and roll off naturally — that's the pressure point that forces re-shopping the bottom of the staff each offseason.
- Firing a coach mid-contract triggers **dead cap**: any remaining guaranteed salary stays committed to the team's budget for the seasons it was originally scheduled, even though the coach is gone. A bad HC hire can hamstring the cap for years.

No explicit "carryover" mechanic is needed — contracts naturally carry APY forward. What the user feels as "carryover" is just their prior-year contracts still consuming cap this year.

**Dead cap mechanics (v1 simple form).**
- Each contract stores: `years`, `apy_cents`, `guarantee_cents` (total dollars guaranteed at signing).
- Firing before contract end → remaining guaranteed money is spread across the remaining contract years at the original APY schedule and continues to count against `committed`. No acceleration to the current year in v1 (no proration model yet — that's the v2 signing-bonus work).
- Contract ends naturally → zero dead cap.

This gives users the emotional "I got stuck with $20M on a coach I fired" story without needing the full NFL proration model yet.

### 2. Counter-offer flow

Extends the existing offer lifecycle; does not replace it.

**Trigger.** On day tick, before `OfferResolver` finalizes acceptances:
1. For each candidate with ≥ 2 `ACTIVE` offers, compute preference score (already done).
2. If the **preferred team** (highest preference score) is *not* the **top-total-score team**, and the preferred team's score is within a **margin threshold** (starting value: **10% of the leading score**), flip that offer to `COUNTER_PENDING`.
3. Attach the leading offer's terms as `competing_terms` on the preferred team's offer so the UI can render "Patriots offered 4yr / $8M — match?"

Using pure preference score keeps the trigger simple and reuses `PreferenceScoringOfferResolver`. The margin is a single tunable.

**Response window.** The counter lives for **N day ticks** (starting value: **2 days**). The preferred team's response options (match-only for v1 — confirmed in review):

- **Match** — clone the competing offer's APY / term / guarantees onto this offer; offer returns to `ACTIVE`.
- **Walk** — decline; offer moves to `REJECTED`.
- **No response by deadline** — implicit walk; offer moves to `REJECTED`.

"Beat" is deferred; match-only avoids penny-beat loops and keeps the UI simple.

Match revalidates against `committed + new_apy ≤ staff_budget`. Can't afford → can't counter → walk.

**CPU behavior.** `CpuHiringStrategy` gets a counter-decision method. Reuse `StanceEvaluator` — if the CPU's stance on this candidate is aggressive enough and budget allows, match. Otherwise walk.

**Resolution.** After the counter window closes, `OfferResolver` re-runs and finalizes:
- If countered → candidate re-scores both offers (preferred team now has improved terms) and picks the winner.
- If walked → leading offer wins.

One round only. If the candidate still prefers the originally-leading team's bid after the match, they sign there. No ping-pong.

**Offer states.** `OfferStatus` gains one value:
- `COUNTER_PENDING` — preferred team has been asked to match.

On match, the offer flips back to `ACTIVE` with the new terms; no separate `COUNTERED` state is needed — the offer row already captures the new APY/terms, and we preserve the history in an offer-revision audit table rather than the status enum. On walk or deadline, the offer moves to `REJECTED` like any other declined offer.

**UI integration (review round 1).** The counter action is **not** a separate phase step and **not** a separate screen. It lives as a third action on the candidate card alongside `Make Offer` / `Renegotiate` / `Hire` — rendered as `Match Offer` (or `Decline & Walk`) when the offer is in `COUNTER_PENDING`. State drives affordances on the same card the user is already looking at; the counter window shows inline as "2 days to respond" on the card. This keeps the hiring UI mental model unchanged: one card per candidate, actions appear as state allows.

### 3. Variable quality across the whole staff

This is the thing that makes the budget decision interesting.

Today, hidden-rating (true vs. scouted, gem/bust noise) is already applied to head coach candidates via the charter's rating philosophy. Extend the same noise model to:

- Coordinators (OC/DC/STC)
- Position coaches
- Scouts (director of scouting already exists; area scouts to follow)

**Salary vs. quality correlation.** Market-priced candidates cluster true rating around what their salary implies, with `busts-and-gems` noise. So:

- Expensive HC + cheap assistants = high HC rating with noisy, possibly-bust assistants. Upside: stars. Downside: whiffs on the majority of the staff.
- Balanced staff = everyone near the median. Lower variance, lower ceiling.
- Cheap HC + expensive assistants = inverted shape; gem-hunt on the HC, buy certainty elsewhere.

Pricing logic: candidate asking-APY draws from the role's distribution, centered on their *true* rating, with gem/bust noise producing mispriced candidates in both directions. The GM's scouted view is noisy; the market's view (what the candidate asks for) is closer to truth but not revealed until offer time.

**Tradeoffs the budget enforces:**

| Shape               | HC     | Coords | Position | Scouts | Bet                                   |
| ------------------- | ------ | ------ | -------- | ------ | ------------------------------------- |
| Star HC             | $12M   | $2M ea | bargain  | mid    | HC overrides weak assistants          |
| Balanced            | $7M    | $2.5M  | $1M ea   | mid    | Floor over ceiling                    |
| Scout-first rebuild | mid    | mid    | cheap    | heavy  | Win draft, grow cheap talent          |
| Gem hunt            | cheap  | cheap  | cheap    | cheap  | Budget surplus → FA player spend      |

Scouts and assistants need their own attributes for this to matter — scouts affect prospect rating accuracy (`busts-and-gems.md`), assistants affect player development and scheme execution. Those interfaces exist or are imminent; this proposal doesn't redesign them, it just asserts that their *market* lives in `staff-market.json` alongside everything else.

### 4. HC vs. scouting prioritization

The same budget funds both (via `staff-market.json`), so the GM is choosing across roles, not within them. That's the point. A user who wants to hire a top-decile HC is implicitly accepting cheaper coordinators, cheaper position coaches, or a weaker scouting department. No extra mechanic needed — the single budget + priced market does the work.

Follow-up question worth flagging for v2: do we want a sub-budget split (e.g. a "coaching" line and a "scouting" line) so the user can't zero out either? Current answer: no, one pool is simpler and more interesting. The floor is that *some* staff must be hired to field a team — that implicit minimum is the real constraint.

## Implementation sketch

High-level; exact interface surface to be designed in the implementation PR.

**Migrations.**
1. Add `staff_budget_cents` to `team` (no committed column — derived).
2. Add `COUNTER_PENDING` to `offer_status` enum.
3. Add `competing_offer_id`, `counter_deadline_day` columns to the candidate offer table.
4. Extend the staff contract table with `years`, `apy_cents`, `guarantee_cents`, `start_season`, `end_season`, `terminated_at_season` to support multi-year obligations and dead cap. (If a single contract table doesn't exist yet, introduce it here.)
5. Optional view `v_team_staff_committed(team_id, season, committed_cents)` backing the derived query.

**Data.**
1. New band: `data/bands/staff-market.json` with per-role salary distributions.
2. Seed team budgets from league-config value at league creation.

**New / changed records and interfaces (all package-private in `league.hiring` unless noted).**
- `MakeOfferResult.InsufficientBudget` — new sealed variant.
- `StaffBudget` (record) — budget + derived committed accessors per team-season.
- `StaffBudgetRepository` — `committed(teamId, season)` query over contracts + active offers + dead cap.
- `OfferResolver` — in its existing day-tick pass, flip close offers to `COUNTER_PENDING` and attach competing terms before finalizing acceptances. Same pass also rejects expired `COUNTER_PENDING` offers whose `counter_deadline_day` has passed.
- `MatchCounterOffer` (use case) — user-facing: accept terms into the offer. Revalidates budget.
- `DeclineCounterOffer` (use case) — user-facing: walk; moves offer to `REJECTED`.
- `CpuHiringStrategy` — add `respondToCounter(...)` using `StanceEvaluator` + budget check.
- `HeadCoachHiringView` / `HeadCoachCandidateView` — surface `COUNTER_PENDING` state, competing terms, deadline day, remaining budget. UI renders match/walk actions on the existing candidate card.
- `MakeOffer` — budget precondition check; returns `InsufficientBudget` when over.

**No new phase step (review round 1).** Counter resolution is *not* its own `HiringStep`. It piggybacks on the existing day-tick offer-resolution pass — expired counters become rejections, pending counters stay pending, and the resolver finalizes acceptances as it does today. The UI surface stays on the candidate card.

**Tests (Testcontainers, per CLAUDE.md).**
- `MakeOffer` rejects when budget exceeded; accepts exactly at the limit.
- `committed(teamId, season)` sums correctly across active offers + signed contracts + dead cap, and excludes rejected/withdrawn offers.
- Multi-year contract counts against each in-range season's committed total.
- Firing a coach mid-contract leaves the guaranteed remainder in `committed` for the original contract years.
- Resolver flips to `COUNTER_PENDING` when margin ≤ threshold and does not when margin > threshold.
- Expired counter → rejection → leading offer wins.
- Successful match → re-resolution picks the preferred team.
- Match that blows budget → rejected with `InsufficientBudget` → walk.
- CPU response path exercised via `StanceEvaluator`.

## Tunables (start values)

All driven by data, not code:

- Team budget: $25M (from `staff-market.json` median × role counts).
- Counter-trigger margin: 10% of leading preference score.
- Counter window: 2 days.
- Counter rounds: 1 (match-only; "beat" deferred).

Expect to tune after the first calibration pass.

## Decisions (review round 1)

- **One budget pool across coaching + scouting.** Confirmed. Priced market does the HC-vs-scouting prioritization work without a sub-budget split.
- **Committed budget is derived from contracts, not a stored counter.** Contracts are source of truth; committed dollars fall out of a query. Avoids drift.
- **Counters live on the candidate card, not in a separate phase step.** Same UX pattern as `Make Offer` / `Renegotiate` / `Hire` today — state on the offer drives which actions appear.
- **Match-only, no "beat".** Deferred.
- **No franchise tags for staff.** Deferred (not even as an open question for v1).
- **Budget carryover is implicit via multi-year contracts.** No explicit mechanic needed. Assistants on 1–2 year deals roll off naturally; HC on a 5-year deal locks cap each season.
- **Dead cap on firings.** A fired coach's remaining guaranteed money stays committed for the original contract seasons. Simple form in v1 (no acceleration / proration).
- **Signing bonuses deferred to v2.** Flat APY + total guarantee amount only in v1.

## Calibration defaults (round 2 research)

Numbers sourced from public reporting on NFL coach and scout contracts. Use these as seeds for `staff-market.json`; expect to tune after playtests.

### Contract length by role (years)

| Role                         | Typical | Min | Max | Notes                                                        |
| ---------------------------- | ------- | --- | --- | ------------------------------------------------------------ |
| Head coach                   | 4–5     | 3   | 6   | Saban/Reid-tier extensions push 6+                           |
| Offensive / Defensive Coord. | 2–3     | 2   | 4   | Top-market coordinators on 3–4yr                             |
| Special teams coordinator    | 2       | 1   | 3   |                                                              |
| Position coach               | 1–2     | 1   | 3   | Mostly 2yr; vet position coaches can get 3yr                 |
| Quality control / analyst    | 1       | 1   | 2   | Effectively year-to-year                                     |
| Director of Scouting         | 2–3     | 2   | 4   | Mirrors coordinator tier                                     |
| Area / college scout         | 2       | 1   | 3   | Two-year is the league-standard "evaluator contract"         |

Distribution shape for the band file: integer draw from a small multinomial centered on "typical," with min/max as hard bounds. Don't overthink — these are year counts, not real numbers.

### Guarantee % at signing

How much of the total contract value (APY × years) is guaranteed on day one. Drives dead cap on firings.

| Role                         | Typical guarantee | Range   | Notes                                                                     |
| ---------------------------- | ----------------- | ------- | ------------------------------------------------------------------------- |
| Head coach                   | **100%**          | 95–100% | Fully guaranteed is the norm — Saleh collected his full $6M after firing  |
| Offensive / Defensive Coord. | 60%               | 40–80%  | Usually year 1 fully guaranteed + partial later years                     |
| Special teams coordinator    | 50%               | 30–70%  |                                                                           |
| Position coach               | 35%               | 20–60%  | Often just year 1 guaranteed                                              |
| Quality control / analyst    | 15%               | 0–30%   | Frequently at-will; weak job security                                     |
| Director of Scouting         | 55%               | 35–75%  | Coordinator-equivalent tier                                               |
| Area / college scout         | 30%               | 10–50%  | Partial guarantee typical on 2yr deals                                    |

Band shape: a triangular or beta distribution per role, with `guarantee_pct` drawn at offer creation and locked into the signed contract. Two candidates at the same role can have different guarantee %s — top-of-market assistants negotiate higher, entry-level take whatever they're offered. This adds a negotiation lever: a team can offer less APY but a higher guarantee % (or vice versa), and the preference score weighs total guaranteed dollars distinctly from APY.

### Implications for the sim

- **HC firings hurt hard.** Full-guarantee HC contracts mean a bad HC hire with 3 years left at $10M/yr = $30M dead cap. If your budget is $25M, firing alone can blow next season.
- **Assistant churn is cheap.** Most position coaches and QC staff are effectively 1yr at 15–35% guarantee — you can reshape the bottom of the staff every offseason without much dead cap.
- **Coordinator and DoS firings are meaningful but survivable.** Mid-range guarantees mean firing a bad OC midway through a 3yr/$3M deal might cost ~$2–4M in dead cap — felt, not catastrophic.

This is the shape of the economy we want: HC hire is the high-stakes commitment, everything below it is flexible.

### Open questions (still)

- **Negotiation lever between APY and guarantee %.** Should the user be able to explicitly trade APY down for higher guarantee (or vice versa) during the offer form? Candidate preference would weight guaranteed dollars higher than APY — risk-averse coaches prefer certainty. Interesting, but possibly v2 depending on UI complexity.
- **Offset language.** NFL contracts often let the old team reduce payouts by what the fired coach earns elsewhere. In a single-franchise sim this is moot for the user but could reduce CPU dead-cap pain. Defer to v2.

## Research sources (round 2)

- [NFL Coaches Contracts – Collins Legal](https://collins.legal/blog/nfl-coaches-contracts/)
- [Do NFL Coaches Get Paid After Being Fired? – Total Pro Sports](https://www.totalprosports.com/nfl/do-nfl-coaches-get-paid-after-being-fired-contract-explained/)
- [Ask the Scouts: 2022 Salaries and Compensation – Succeed in Football](https://succeedinfootball.com/2022/03/04/ask-the-scouts-a-look-at-2022-salaries-and-compensation/)
- [How Much Does an NFL Scout Make? – Sports Management Worldwide](https://www.sportsmanagementworldwide.com/content/how-much-does-nfl-scout-make-salaries-job-paths-insider-insights-smww)
- [NFL Assistant Coach Salary List 2025 – GlowsMagazine](https://glowsmagazine.com/nfl-assistant/)
