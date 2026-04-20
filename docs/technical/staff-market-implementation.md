# Staff Market + Counter-Offers + Dead Cap — Implementation Blueprint

**Spec:** `docs/product/proposals/staff-market-counter-offers.md`
**Feature package:** `app.zoneblitz.league.hiring` (package-private unless noted)
**Latest migration:** V11 — next migration starts at V12

---

## 1. Dependency Graph

Three mandatory layers must land in sequence. Within each layer, individual pieces can run concurrently.

```
Layer 0 — Schema Foundation (sequential; nothing else can start)
  V12: teams.staff_budget_cents + candidate_offers counter columns + status enum expansion
  V13: staff_contracts table
  → Both require jOOQ regen before any Java work begins
  → No Java changes land until regen is done

Layer 1 — Budget Query (depends on Layer 0; parallelizable within)
  A. StaffBudgetRepository interface + JooqStaffBudgetRepository (reads staff_contracts + candidate_offers)
  B. Budget seeding at league creation (SetupLeague or equivalent populates staff_budget_cents)
  A and B can run concurrently — they touch different files

Layer 2 — Enforcement + Counter-Offer Logic (depends on Layer 1A)
  C. MakeOffer.InsufficientBudget variant + budget precondition in MakeOfferUseCase
  D. PreferenceScoringOfferResolver counter-trigger + expiry passes
  E. MatchCounterOffer + DeclineCounterOffer use cases (user-facing)
  F. CpuHiringStrategy.respondToCounter (CPU-facing)
  G. HireCandidateUseCase inserts StaffContract at hire time
  C, D, E, F, G can run concurrently once Layer 1A is done

Layer 3 — UI + Variable Quality (depends on Layer 2)
  H. HeadCoachCandidateView + OfferView counter fields + HeadCoachHiringViewModel update
  I. HiringHeadCoachController new endpoints
  J. head-coach-fragments.html counter UI block
  K. staff-market.json + CoordinatorGenerator / PositionCoachGenerator band update
  H, I, J can run concurrently; K is independent of H/I/J
```

**Concurrency summary:** Layer 0 is strictly sequential (schema + regen gate everything). After regen, Layer 1A and 1B run in parallel. After 1A, C/D/E/F/G all run in parallel (they own non-overlapping files). Layer 3 runs after D and E land.

---

## 2. Migrations in Order

All migrations live in `src/main/resources/db/migration/`.

### V12 — Staff budget + counter-offer columns

Touches existing tables. Requires jOOQ regen.

- `ALTER TABLE teams ADD COLUMN staff_budget_cents BIGINT NOT NULL DEFAULT 0` — default 0; seeded by application code at league creation.
- Drop existing CHECK on `candidate_offers.status` (Postgres requires drop+recreate).
- Add new CHECK: `CHECK (status IN ('ACTIVE', 'ACCEPTED', 'REJECTED', 'COUNTER_PENDING'))`.
- `ALTER TABLE candidate_offers ADD COLUMN competing_offer_id BIGINT REFERENCES candidate_offers(id)` — nullable.
- `ALTER TABLE candidate_offers ADD COLUMN counter_deadline_day INTEGER` — nullable.
- Drop existing partial unique index `candidate_offers_one_active_per_team` (`WHERE status = 'ACTIVE'`).
- Recreate as `WHERE status IN ('ACTIVE', 'COUNTER_PENDING')`.
- Add CHECK: `CHECK ((competing_offer_id IS NULL) = (counter_deadline_day IS NULL))`.

**jOOQ regen required after V12.**

### V13 — Staff contracts table

New table. Requires jOOQ regen.

```sql
CREATE TABLE staff_contracts (
    id BIGSERIAL PRIMARY KEY,
    team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    candidate_id BIGINT NOT NULL REFERENCES candidates(id),
    team_staff_id BIGINT NOT NULL REFERENCES team_staff(id) ON DELETE CASCADE,
    apy_cents BIGINT NOT NULL,
    guarantee_cents BIGINT NOT NULL,
    contract_years INTEGER NOT NULL,
    start_season INTEGER NOT NULL,
    end_season INTEGER NOT NULL,
    terminated_at_season INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (apy_cents > 0),
    CHECK (guarantee_cents >= 0),
    CHECK (contract_years > 0),
    CHECK (end_season >= start_season),
    CHECK (terminated_at_season IS NULL OR terminated_at_season BETWEEN start_season AND end_season)
);
CREATE INDEX staff_contracts_team_idx ON staff_contracts (team_id);
CREATE INDEX staff_contracts_team_season_idx ON staff_contracts (team_id, start_season, end_season);
```

**jOOQ regen required after V13.**

### V14 — Committed view (optional)

Skip in v1. Inline the query in `JooqStaffBudgetRepository`. Add later if profiling shows a bottleneck.

### Budget seeding

Not a migration. Happens in application code at league creation — seed value comes from a constant in the league-creation service, not static SQL.

### staff-market.json

Not a migration. New classpath resource at `data/bands/staff-market.json` (exposed via `build.gradle.kts` resource inclusion). Drives contract length, guarantee %, and per-role salary distributions at hire and generation time.

---

## 3. Interfaces and Records

All types package-private in `app.zoneblitz.league.hiring` unless noted.

### New Records

**`StaffContract`** — domain record for a signed contract.

Fields: `long id`, `long teamId`, `long candidateId`, `long teamStaffId`, `long apyCents`, `long guaranteeCents`, `int contractYears`, `int startSeason`, `int endSeason`, `Optional<Integer> terminatedAtSeason`.

Invariants enforced in compact constructor: `apyCents > 0`, `guaranteeCents >= 0`, `endSeason >= startSeason`, `terminatedAtSeason` in `[startSeason, endSeason]` when present.

**`NewStaffContract`** — write-side record for repository insert.

Fields: `long teamId`, `long candidateId`, `long teamStaffId`, `long apyCents`, `long guaranteeCents`, `int contractYears`, `int startSeason`, `int endSeason`.

**`StaffBudget`** — view record for a team's budget state in a season.

Fields: `long teamId`, `int season`, `long budgetCents`, `long committedCents`.

Derived: `long availableCents()` → `budgetCents - committedCents`; `boolean canAfford(long additionalCents)` → `committedCents + additionalCents <= budgetCents`.

**`CounterDetails`** — embedded in `OfferView` when offer is `COUNTER_PENDING`.

Fields: `long competingOfferId`, `BigDecimal competingCompensation`, `int competingContractYears`, `BigDecimal competingGuaranteedMoneyPct`, `int deadlineDay`, `int currentDay`. Derived: `int daysRemaining()` → `deadlineDay - currentDay`.

### New Interfaces

**`StaffBudgetRepository`** — internal seam.

```java
/** Derives committed budget for a team-season from contracts + active/counter-pending offers + dead cap. */
StaffBudget committed(long teamId, int season);
```

Computation:
```
committed(team, season) =
    SUM(apy_cents) FROM staff_contracts
      WHERE season IN [start_season, end_season]
        AND (terminated_at_season IS NULL OR season <= terminated_at_season)
  + SUM(offer_apy_cents) FROM candidate_offers
      WHERE team_id = team AND status IN ('ACTIVE', 'COUNTER_PENDING')
  + SUM(dead_cap_cents per season) for terminated contracts with remaining guarantee
```

Dead cap per terminated-contract season: `guarantee_cents / contract_years` spread across `[terminated_at_season+1, end_season]`.

**`StaffContractRepository`** — internal seam.

```java
StaffContract insert(NewStaffContract contract);
List<StaffContract> findActiveForTeam(long teamId);
void terminate(long contractId, int atSeason);
```

**`MatchCounterOffer`** — use case.

```java
/**
 * User accepts the counter terms. Validates budget, copies competing offer's APY/years/guarantee
 * onto this offer, flips status back to ACTIVE with stance PENDING.
 *
 * @return one of: Matched, NotFound, NotCounterPending, InsufficientBudget, DeadlineExpired.
 */
MatchCounterOfferResult match(long leagueId, long offerId, String ownerSubject);
```

**`DeclineCounterOffer`** — use case.

```java
/** User declines the counter. Moves offer to REJECTED. */
DeclineCounterOfferResult decline(long leagueId, long offerId, String ownerSubject);
```

### New Sealed Result Types

**`MatchCounterOfferResult`**: `Matched(CandidateOffer offer)`, `NotFound(long leagueId)`, `NotCounterPending(long offerId)`, `InsufficientBudget(long teamId, long availableCents, long requiredCents)`, `DeadlineExpired(long offerId, int deadlineDay, int currentDay)`.

**`DeclineCounterOfferResult`**: `Declined(long offerId)`, `NotFound(long leagueId)`, `NotCounterPending(long offerId)`.

### Modified Existing Types

**`OfferStatus`** — add `COUNTER_PENDING`.

**`CandidateOffer`** — add `Optional<Long> competingOfferId` and `Optional<Integer> counterDeadlineDay`. Compact-constructor guard: both present together or both absent.

**`MakeOfferResult`** — add `record InsufficientBudget(long teamId, long availableCents, long requiredCents) implements MakeOfferResult {}`. Do **not** add `ActiveOfferExists` (referenced in Javadoc but doesn't exist today; revisions return `Created`).

**`OfferView`** — add `Optional<CounterDetails> counterDetails`, `boolean isCounterPending()`.

**`HeadCoachCandidateView`** — add `long remainingBudgetCents`.

**`HeadCoachHiringView`** — add `StaffBudget budget`.

**`CandidateOfferRepository`** — add:

```java
List<CandidateOffer> findOutstandingForTeam(long teamId);          // ACTIVE + COUNTER_PENDING
List<CandidateOffer> findCounterPendingForLeague(long leagueId);
CandidateOffer flipToCounterPending(long offerId, long competingOfferId, int deadlineDay);
CandidateOffer acceptCounter(long offerId, String newTermsJson, int currentDay);
```

Existing `findActiveForTeam()` keeps `WHERE status = 'ACTIVE'` semantics — `CpuHiringStrategy.submitOfferIfNone()` correctly should not count `COUNTER_PENDING` as "already has active offer." See open question 4.

**`ViewHeadCoachHiringUseCase`** — switch call to `offers.findOutstandingForTeam(teamId)`. Inject `StaffBudgetRepository`. Pass budget to `HeadCoachHiringViewModel.assemble()`.

**`HeadCoachHiringViewModel`** — update `assemble()` signature. `toOfferView()` populates `counterDetails` when status is `COUNTER_PENDING`. `toRow()` populates `remainingBudgetCents`.

**`MakeOfferUseCase`** — inject `StaffBudgetRepository`. Before existing-offer check, return `InsufficientBudget` when `committedCents + apyCents > budgetCents`. Convert dollars→cents via `terms.compensation().movePointRight(2).longValueExact()`.

**`PreferenceScoringOfferResolver`** — inject `StaffBudgetRepository`. Add `COUNTER_MARGIN = 0.10`, `COUNTER_WINDOW_DAYS = 2`. `resolve()` gains three new passes before the existing `restance()` call:

1. **`expireDeadCounters(leagueId, dayAtResolve)`** — for each `COUNTER_PENDING` with `counterDeadlineDay < dayAtResolve`, resolve to `REJECTED`.
2. **`cpuRespondToCounters(...)`** — for each `COUNTER_PENDING` on a CPU team, call `cpuStrategy.respondToCounter(...)`.
3. **`triggerCounters(...)`** — for each unhired candidate with 2+ ACTIVE offers: score all, find preferred (highest preference score) and leading (highest total). If preferred ≠ leading and `(leadingScore - preferredScore) / leadingScore <= COUNTER_MARGIN`, call `flipToCounterPending(preferredOfferId, leadingOfferId, dayAtResolve + COUNTER_WINDOW_DAYS)`.

**`CpuHiringStrategy`** — add:

```java
void respondToCounter(long leagueId, long teamId, int phaseDay,
                      CandidateOffer counterPendingOffer, CandidateOffer competingOffer,
                      StaffBudget budget);
```

Logic: load preferences. If stance toward candidate is `INTERESTED` AND `budget.canAfford(competingApy)`, call `acceptCounter(...)`; else resolve to `REJECTED`.

**`HireCandidateUseCase`** — inject `StaffContractRepository`. After existing `upsertHired()`, insert a `StaffContract` with `apyCents`, `contractYears`, `guaranteeCents` computed from `OfferTerms`. Same logic mirrored in `PreferenceScoringOfferResolver.finalizeHire()` for CPU auto-hires.

---

## 4. State Transitions

```
    insertActive()
        │
        ▼
    [ACTIVE / stance=PENDING]
        │
        ├── tick: score >= AGREE_THRESHOLD → stance=AGREED
        │       └── user clicks Hire → [ACCEPTED] ──► insert StaffContract
        │
        ├── tick: score < threshold, revisions < cap → stance=RENEGOTIATE
        │       └── user revises terms → back to [ACTIVE / stance=PENDING]
        │
        ├── tick: score < threshold, revisions >= cap → [REJECTED]
        │
        └── tick: preferred team, margin ≤ 10%, 2+ active offers
                ▼
        [COUNTER_PENDING / competing_offer_id set / counter_deadline_day set]
                │
                ├── user MatchCounterOffer → budget OK
                │       └── [ACTIVE / new terms / stance=PENDING] — continues normal lifecycle
                │
                ├── user MatchCounterOffer → budget fails
                │       └── InsufficientBudget; offer stays COUNTER_PENDING
                │           until Decline or deadline expires
                │
                ├── user DeclineCounterOffer → [REJECTED]
                ├── CPU respondToCounter → match → [ACTIVE / new terms]
                ├── CPU respondToCounter → walk → [REJECTED]
                └── tick: currentDay > counter_deadline_day → [REJECTED]

    [ACCEPTED] — terminal; triggers StaffContract insert
    [REJECTED] — terminal
```

**Transition guards and side effects:**

| Transition | Guard | Side Effects |
|---|---|---|
| ACTIVE → COUNTER_PENDING | preferred ≠ leading; margin ≤ 10%; no existing COUNTER_PENDING | sets `competing_offer_id`, `counter_deadline_day = currentDay + 2` |
| COUNTER_PENDING → ACTIVE (match) | `budget.canAfford(competingApy)`; currentDay ≤ deadline | copies competing terms; clears counter fields; stance = PENDING |
| COUNTER_PENDING → REJECTED | user decline OR currentDay > deadline OR CPU walks | none; leading offer still in play |
| ACTIVE/COUNTER_PENDING → ACCEPTED | stance = AGREED AND user clicks Hire | `StaffContract` inserted; sibling offers REJECTED; `TeamHiringState` → HIRED |

**Idempotency:** `expireDeadCounters()` idempotent (REJECTED can't re-expire). `triggerCounters()` skips candidates already with a COUNTER_PENDING. Running `resolve()` twice same day produces same result.

**`StaffContract` lifecycle:**

```
insert at hire
    └── active for seasons [start_season .. end_season]
            ├── season increments → APY counts against budget each season
            └── coach fired → terminate(contractId, currentSeason)
                    └── dead cap: remaining guarantee in committed() for seasons
                                  [terminatedAtSeason+1 .. end_season]
```

---

## 5. UI Surface

### New HTMX Endpoints

All on `HiringHeadCoachController`. All return `"league/hiring/head-coach-fragments :: combined"` on success.

```
POST /leagues/{id}/hiring/head-coach/counter/{offerId}/match
  → MatchCounterOffer.match(id, offerId, principal.sub)
  → 200: re-render combined
  → 409: InsufficientBudget, NotCounterPending
  → 404: NotFound
  → 422: DeadlineExpired

POST /leagues/{id}/hiring/head-coach/counter/{offerId}/decline
  → DeclineCounterOffer.decline(id, offerId, principal.sub)
  → 200: re-render combined
  → 409: NotCounterPending
  → 404: NotFound
```

No new full-page endpoints.

### Template Changes

**`src/main/resources/templates/league/hiring/head-coach-fragments.html`**

`candidates` fragment gains a new `th:block` inside `th:if="${row.canOffer()}"`:

```
th:if="${row.hasOffer() and row.offer().get().isCounterPending()}"
→ render:
  - Competing terms: "$X / Y yr / Z% guaranteed"
  - Deadline: "N days to respond"
  - Match button: hx-post to /counter/{offerId}/match
  - Decline & walk button: hx-post to /counter/{offerId}/decline
```

Existing `Hire` button (`isAgreed()`) — no change.

Existing `Revise / Make offer` button — add `and not row.offer().get().isCounterPending()` to hide while counter pending.

Add budget line to panel header: `"Budget: $X available of $Y total"` from `view.budget()`.

Counter block is **inline `th:block`** within `candidates`, not a separate fragment — matches "state drives affordances on the same card."

**`head-coach.html`** — no structural changes.

---

## 6. Test Plan

All DB-touching tests use `@JooqTest` + `PostgresTestcontainer`. Naming: `method_condition_expectedOutcome`.

### `JooqStaffBudgetRepositoryTests` (new)

- `committed_noContracts_returnsZero`
- `committed_singleActiveContract_returnsApy`
- `committed_multiYearContract_countsInEachSeason`
- `committed_contractEndedBeforeSeason_notCounted`
- `committed_terminatedContractWithGuarantee_countsDeadCapInRemainingSeasonsNotPresentSeason`
- `committed_activePendingOffer_includesOfferApy`
- `committed_counterPendingOffer_includesOfferApy`
- `committed_rejectedOffer_excluded`
- `committed_acceptedOffer_excludedIfContractAlreadyCounted`

### `MakeOfferUseCaseTests` (extend)

- `offer_budgetExceeded_returnsInsufficientBudget`
- `offer_exactlyAtBudgetLimit_returnsCreated`
- `offer_withExistingActiveOfferOnOtherCandidate_reducesAvailableBudget`

### `JooqMatchCounterOfferUseCaseTests` (new)

- `match_validCounter_flipsToActiveWithNewTerms`
- `match_budgetExceeded_returnsInsufficientBudget`
- `match_offerNotCounterPending_returnsNotCounterPending`
- `match_deadlineExpired_returnsDeadlineExpired`
- `match_leagueNotFound_returnsNotFound`

### `JooqDeclineCounterOfferUseCaseTests` (new)

- `decline_validCounter_returnsDeclined`
- `decline_offerNotCounterPending_returnsNotCounterPending`
- `decline_leagueNotFound_returnsNotFound`

### `PreferenceScoringOfferResolverTests` (extend)

- `resolve_preferredTeamCloseToLeader_flipsToCounterPending`
- `resolve_preferredTeamBeyondMargin_doesNotFlip`
- `resolve_counterPendingExpired_rejectsOffer`
- `resolve_matchedCounter_reResolvesAndPicksPreferredTeam`
- `resolve_walkedCounter_leadingOfferWins`
- `resolve_cpuMatchesCounter_ifBudgetAllowsAndStanceAggressive`
- `resolve_cpuWalksCounter_ifBudgetInsufficient`
- `resolve_idempotent_noChangesOnSecondRunSameDay`

### `HireCandidateUseCaseTests` (extend)

- `hire_createsStaffContract_withCorrectApyAndYears`
- `hire_createsStaffContract_withCorrectGuaranteeCents`

### `JooqStaffContractRepositoryTests` (new)

- `insert_validContract_persistsAllFields`
- `findActiveForTeam_excludesTerminated`
- `terminate_setsTerminatedAtSeason`

### Test data builders

All in `src/test/java/app/zoneblitz/league/hiring/`:

- `StaffContractBuilder` — builds `NewStaffContract` / `StaffContract`
- `StaffBudgetBuilder` — builds `StaffBudget` for view-model unit tests

No `InMemory*Repository`. All DB tests use Testcontainers.

---

## 7. staff-market.json Schema

Path: `data/bands/staff-market.json` (classpath: `/bands/staff-market.json`).

Per-role contract-structure distributions. Roles match `CandidateKind` values (verify alignment before writing).

```json
{
  "generated_at": "...",
  "source": "docs/product/proposals/staff-market-counter-offers.md calibration round 2",
  "roles": {
    "HEAD_COACH": {
      "contract_length_years": { "min": 3, "mode": 5, "max": 6, "distribution": "triangular" },
      "guarantee_pct":         { "min": 0.95, "typical": 1.00, "max": 1.00, "distribution": "triangular" },
      "salary_annual_usd":     { "p10": 5500000, "p50": 8500000, "p90": 14000000, "ceiling": 20000000 }
    },
    "OFFENSIVE_COORDINATOR": {
      "contract_length_years": { "min": 2, "mode": 3, "max": 4, "distribution": "triangular" },
      "guarantee_pct":         { "min": 0.40, "typical": 0.60, "max": 0.80, "distribution": "triangular" },
      "salary_annual_usd":     { "p10": 1500000, "p50": 2300000, "p90": 4000000, "ceiling": 6500000 }
    },
    "DIRECTOR_OF_SCOUTING": {
      "contract_length_years": { "min": 2, "mode": 3, "max": 4, "distribution": "triangular" },
      "guarantee_pct":         { "min": 0.35, "typical": 0.55, "max": 0.75, "distribution": "triangular" },
      "salary_annual_usd":     { "p10": 300000, "p50": 475000, "p90": 800000, "ceiling": 1200000 }
    }
  }
}
```

Full role list: `HEAD_COACH`, `OFFENSIVE_COORDINATOR`, `DEFENSIVE_COORDINATOR`, `SPECIAL_TEAMS_COORDINATOR`, `POSITION_COACH`, `QUALITY_CONTROL`, `DIRECTOR_OF_SCOUTING`, `AREA_SCOUT`.

New typed reader `StaffMarketBands` (package-private) follows `HeadCoachMarketBands` / `ScoutMarketBands` pattern: loads once at construction via `loadFromClasspath("/bands/staff-market.json")`, parses with Jackson. Exposes `contractLengthFor(CandidateKind)`, `guaranteePctFor(CandidateKind)`.

---

## 8. Work-Stream Split

After V12/V13 migrations land and jOOQ regen completes, six streams can run concurrently. No stream touches another's files except via agreed interfaces defined upfront.

### Stream A — Schema Domain Records + Repositories

**Files owned (new):** `StaffContract.java`, `NewStaffContract.java`, `StaffBudget.java`, `StaffBudgetRepository.java`, `JooqStaffBudgetRepository.java`, `StaffContractRepository.java`, `JooqStaffContractRepository.java`, `JooqStaffBudgetRepositoryTests.java`, `JooqStaffContractRepositoryTests.java`, `StaffContractBuilder.java`.

**Files read:** jOOQ generated types for `candidate_offers`, `staff_contracts`, `teams`.

**Delivers:** `StaffBudgetRepository`, `StaffContractRepository` interfaces.

### Stream B — MakeOffer Budget Enforcement

**Prerequisite:** Stream A's `StaffBudgetRepository` interface defined.

**Files owned:** `MakeOfferResult.java` (add variant), `MakeOfferUseCase.java` (inject + precondition), `MakeOfferUseCaseTests.java` (extend).

**Files read:** `MakeOffer.java` (interface), `StaffBudgetRepository.java` (interface only), `JooqCandidateOfferRepository.java`.

### Stream C — Counter-Offer Use Cases

**Prerequisite:** Stream A's `StaffBudgetRepository` interface; `CandidateOfferRepository` extensions (`flipToCounterPending`, `acceptCounter`) must be agreed upfront.

**Files owned (new):** `CounterDetails.java`, `MatchCounterOffer.java`, `MatchCounterOfferResult.java`, `MatchCounterOfferUseCase.java`, `DeclineCounterOffer.java`, `DeclineCounterOfferResult.java`, `DeclineCounterOfferUseCase.java`, `JooqMatchCounterOfferUseCaseTests.java`, `JooqDeclineCounterOfferUseCaseTests.java`.

**Files read:** `CandidateOfferRepository.java`, `StaffBudgetRepository.java`.

### Stream D — Resolver + CPU Counter Response

**Prerequisite:** Stream A complete; new `CandidateOfferRepository` methods defined.

**Files owned:** `PreferenceScoringOfferResolver.java` (add passes), `CpuHiringStrategy.java` (add `respondToCounter`), `HireCandidateUseCase.java` (inject + contract insert), `PreferenceScoringOfferResolverTests.java` (extend), `HireCandidateUseCaseTests.java` (extend).

**Files read:** `OfferStatus.java`, `CandidateOfferRepository.java`, `StaffBudgetRepository.java`, `StaffContractRepository.java`.

### Stream E — staff-market.json + Generator Updates

Fully independent of B/C/D. Can start as soon as V12/V13 jOOQ regen completes (doesn't technically need regen — no DB touch).

**Files owned (new):** `data/bands/staff-market.json`, `StaffMarketBands.java`. **Modified:** `CoordinatorGenerator.java`, `PositionCoachGenerator.java`.

**Files read:** `HeadCoachMarketBands.java`, `ScoutMarketBands.java`, `CandidateKind.java`.

### Stream F — UI Layer

**Prerequisite:** Stream C use-case interfaces defined; otherwise parallel with D/E.

**Files owned:** `OfferView.java`, `HeadCoachCandidateView.java`, `HeadCoachHiringView.java`, `HeadCoachHiringViewModel.java`, `ViewHeadCoachHiringUseCase.java`, `HiringHeadCoachController.java`, `head-coach-fragments.html`.

**Files read:** `MatchCounterOffer.java`, `DeclineCounterOffer.java`, result types, `StaffBudget.java`, `CounterDetails.java`.

---

## 9. Open for Architect Input

Items underspecified in the proposal or needing a decision before the corresponding stream starts.

1. **staff-market.json vs. coach-market.json coexistence.** `coach-market.json` drives candidate generation (salary ranges, age, experience). The new `staff-market.json` adds contract structure at hire time (guarantee %, contract years). `CoordinatorGenerator` and `PositionCoachGenerator` currently use HC salary bands as a fraction-based anchor. Should the `salary_annual_usd` columns in `staff-market.json` replace the coordinator/position-coach entries in `coach-market.json`, or stay separate? Affects Stream E scope.

2. **Budget check for team's own COUNTER_PENDING offers.** Proposal says committed = contracts + ACTIVE + COUNTER_PENDING. Confirm: if the team has a COUNTER_PENDING offer at $8M/yr and the user wants to make a $3M/yr offer on another candidate, does the $8M count against available budget even before the match is confirmed?

3. **League season number.** `HireCandidateUseCase` needs `currentSeason` to populate `StaffContract.startSeason`. `LeagueSummary` doesn't expose `season()`; `leagues` table has no `season` column today. Either add `int season()` to `LeagueSummary` (and a column) or derive from `LeaguePhase` + phase progression. Decision needed before `HireCandidateUseCase` changes.

4. **CPU new offer while its own COUNTER_PENDING exists.** `CpuHiringStrategy.submitOfferIfNone()` checks `findActiveForTeam()` which returns only ACTIVE. So a CPU team may place a new offer on a different candidate while its own counter is outstanding. Intended? If not, switch to `findOutstandingForTeam()`.

5. **APY dollars vs. cents.** `OfferTerms.compensation` is `BigDecimal` in dollars (e.g., `8500000.00`). `StaffContract.apyCents` is `BIGINT`. Conversion `compensation.movePointRight(2).longValueExact()` throws if value has >2 decimals. Confirm offer form/validation guarantees ≤2 decimal places.

6. **DoS counter flow scope.** `HiringDirectorOfScoutingController` + `DirectorOfScoutingHiringView` mirror the HC versions. Mechanism is role-agnostic. Should Streams C/D/F implement the counter flow generically (any phase) or HC-specific, deferring DoS to a follow-up?
