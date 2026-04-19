# League phases — design

Context handoff for future sessions. Covers the phase state machine that drives the league dashboard from creation through the start of the inaugural draft. Out of scope here: draft, season, offseason phases (tracked when built).

If code and this doc disagree, read the code and update the doc. If the charter and this doc disagree, the charter wins.

> **Update (2026-04):** The "scouted attribute / noise-reduction interview" mechanic described below is deprecated. Coaching ability is hidden from the user entirely (no scouted rating shown). Interviews now produce a deterministic **mutual-interest signal** (INTERESTED / LUKEWARM / NOT_INTERESTED) derived from the candidate's preferences against the team's profile — one interview per candidate, no RNG. `candidates.scouted_attrs` and `team_interviews.scouted_overall` have been removed (V9 migration); `team_interviews.interest_level` replaces the latter. CPU hiring and the best-fit autofill both rank on preference fit; hidden ratings are never consulted during hiring.

---

## Model

A league has one `LeaguePhase` at a time. Progression is **lockstep across all franchises** in the league — the phase is a league-level state, not per-franchise.

Within a phase, a league has a **week counter** (`phaseWeek`, 1-indexed). Each phase defines a fixed `maxWeeks`. Week advance is user-triggered from the dashboard.

Inside a phase, each franchise has its own sub-state (e.g. `HiringStep` during a hiring phase). Sub-state is per-franchise, not per-league.

---

## Phases (v1 scope)

| Phase | Purpose | User actions | Programmatic actions |
|---|---|---|---|
| `INITIAL_SETUP` | Landing after league creation. Dashboard intro. | Advance to start hiring. | None. |
| `HIRING_HEAD_COACH` | Each franchise hires a Head Coach. | View pool, interview, negotiate, accept. Advance week. | CPU franchises run same loop. Autofill on week cap. |
| `HIRING_DIRECTOR_OF_SCOUTING` | Same flow, DoS role. | Same as above. | Same as above. |
| `ASSEMBLING_STAFF` | HC hires coordinators; DoS hires scouts. Programmatic for v1. | View recap of reports hired league-wide. Advance. | HC picks coordinators; DoS picks scouts. One tick, then phase completes. |

Next phase after `ASSEMBLING_STAFF` is TBD (inaugural draft prep). Not in this doc.

### Charter reconciliation

Charter [`docs/product/north-star/charter.md`](../product/north-star/charter.md) line 45 describes HC/DoS returning a shortlist for the user to pick from. **v1 ships programmatic** (HC/DoS picks directly). Shortlist mechanic is future work. Update the charter when shortlist lands.

---

## Hiring sub-state machine

Shared between `HIRING_HEAD_COACH` and `HIRING_DIRECTOR_OF_SCOUTING`. Each franchise holds its own `HiringStep`:

```
SEARCHING → HIRED
```

`SEARCHING` is not a single linear state — it composes several concurrent activities the franchise can perform in any given week:

- **Browse the pool** — franchise browses the league-wide candidate pool. Can shortlist candidates.
- **Interview** — franchise interviews shortlisted candidates. Interview reveals hidden attributes with noise (see [`busts-and-gems.md`](../product/north-star/busts-and-gems.md)). Multiple interviews per week allowed, bounded by capacity (TBD — default 3/week).
- **Offer** — franchise submits an offer to one or more candidates. Offers are resolved at the next week tick (see below).
- `NEGOTIATING` — franchise has made an offer to a candidate. Candidates are **not locked** to a single franchise; multiple franchises can have active offers on the same candidate.
- `HIRED` — terminal for the phase. Franchise waits for remaining teams or week cap.

### Offer resolution

Candidates have **preferences** — a domain concept describing what they want from a position (compensation, role scope, franchise traits, etc. — detail TBD). At each week tick, every candidate with one or more active offers evaluates them against preferences and accepts their favorite; losing franchises' offers are rejected. Those franchises remain in `SEARCHING` and can submit new offers the following week against the remaining pool.

Implication: a franchise can pursue multiple candidates in parallel (one offer each), but each candidate resolves once per week tick. This is the core scarcity mechanic — a team can "lose" a candidate they were counting on and must rebound.

---

## Candidate preferences

Every candidate has a row in `candidate_preferences`. The same set of dimensions applies uniformly to both Head Coach and Director of Scouting candidates (and, when added, their subordinates). Wide table — one typed column pair per dimension (`<dim>_target` and `<dim>_weight`). Weights are per-candidate; they define how that candidate prioritizes dimensions against each other. Scoring function for an offer:

```
score(offer, candidate) = Σ over dimensions d of: weight_d * fit_d(target_d, franchise_or_offer_value_d)
```

`fit_d` is dimension-specific and normalized to `[0, 1]`. Candidate accepts the highest-scoring active offer at the week tick; ties broken randomly with the candidate's seeded RNG.

### Dimensions

| Dimension | Target type | Sourced from (franchise side) | Notes |
|---|---|---|---|
| `compensation` | NUMERIC (annual salary $USD) | offer `terms` | Target sampled from `coach-market.json` / `scout-market.json` per tier. Floor-style fit: full below target, drops sharply; saturates above. |
| `contract_length` | INT (years) | offer `terms` | Target sampled from band file `contract_length_years`. Bell around target. |
| `guaranteed_money` | NUMERIC (% of total) | offer `terms` | Per `buyout_convention` in band file (HC contracts effectively fully guaranteed; DoS less so). Floor at target. |
| `market_size` | ENUM `SMALL` / `MEDIUM` / `LARGE` | franchise city (static v1) | Categorical fit. |
| `geography` | ENUM region (NE / SE / MW / SW / W) | franchise city (static v1) | Categorical, supports multi-value match via `geography_target` as preferred + fallback. |
| `climate` | ENUM `WARM` / `COLD` / `NEUTRAL` | franchise city (static v1) | Categorical. |
| `franchise_prestige` | NUMERIC 0–100 | franchise dynamic rating (v1: all equal) | See v1 note below. |
| `competitive_window` | ENUM `CONTENDER` / `NEUTRAL` / `REBUILD` | franchise dynamic rating (v1: all `NEUTRAL`) | See v1 note below. |
| `role_scope` | ENUM `LOW` / `MEDIUM` / `HIGH` (autonomy) | offer `terms` | User-declared per offer. |
| `staff_continuity` | ENUM `KEEP_EXISTING` / `BRING_OWN` / `HYBRID` | offer `terms` | HC cares about coordinators; DoS cares about scouts. |
| `scheme_alignment` | ENUM scheme tag | franchise roster fit score | Candidate preference matches roster's best-fit scheme. |
| `owner_stability` | NUMERIC 0–100 | franchise dynamic rating (v1: all equal) | See v1 note below. |
| `facility_quality` | NUMERIC 0–100 | franchise static rating (v1: all equal) | See v1 note below. |

Every dimension ships a paired `<dim>_weight NUMERIC` column (0–1, normalized across dimensions per-candidate).

### v1 equal-footing note

`franchise_prestige`, `competitive_window`, `owner_stability`, and `facility_quality` depend on dynamic franchise ratings. **In v1 all franchises are on equal footing** — these dimensions resolve to identical values across franchises and therefore do not discriminate between offers. Candidates still carry weights on them (no data loss), they just won't differentiate v1 decisions. Dynamic franchise ratings are a future design doc; when landed, these columns start mattering without schema change.

Phase ends when either:
- All franchises reach `HIRED`, or
- `phaseWeek > maxWeeks` — any franchise not at `HIRED` gets an auto-assigned hire from the remaining pool.

`maxWeeks` defaults: `HIRING_HEAD_COACH = 3`, `HIRING_DIRECTOR_OF_SCOUTING = 3`, `ASSEMBLING_STAFF = 1`.

---

## Candidate pool

League-wide, shared across all franchises. Generated at phase entry; drives the scarcity economy ([`scarcity-economy.md`](../product/north-star/scarcity-economy.md)).

- Generated per phase entry from `data/bands/`:
  - HC candidates: [`data/bands/coach-market.json`](../../data/bands/coach-market.json) (tier `HC`). Salary, contract length, buyout convention, age, experience, coaching-tree branches, play-caller specialty split — all NFL-accurate priors.
  - DoS candidates: [`data/bands/scout-market.json`](../../data/bands/scout-market.json) (top tier — Director / VP of Player Personnel equivalent).
- **NFL-accurate compensation assumption.** The fictional league operates with NFL-equivalent budgets. Candidate salary expectations, contract lengths, and guarantees are drawn directly from these band files — no synthetic scaling. A generated HC's `compensation` preference target is sampled from `coach-market.json` `tiers.HC.salary_annual_usd`; contract length from `contract_length_years`; guarantees follow `buyout_convention`.
- Candidates have hidden true attributes; franchises see only scouted signal.
- Pool size: 2–3× franchise count for HC/DoS phases.
- A candidate hired by any franchise is removed from the pool immediately.

### Specialty

Every coach and scout candidate has a **position specialty** — the position they are expert in. Applies uniformly to all coaching and scouting roles (HC, coordinators, position coaches, DoS, scouts). Examples: an HC who is a "QB guru", a DoS who is a "DT evaluator", a position coach whose specialty matches their role.

- Stored as a first-class column on the `candidate` table: `specialty_position` (ENUM over the league's position set — QB, RB, WR, TE, OL, DL, EDGE, LB, CB, S, K, P, etc.).
- Position coaches' specialties match their role by construction (a QB coach has `specialty_position = QB`). HC, coordinator, DoS, and scout specialties are sampled from a distribution — for HC/OC, offensive positions are favored; DC favors defense; DoS is broad; scouts skew toward specific position groups. Exact priors drawn from `coach-market.json` / `scout-market.json`.
- Specialty is orthogonal to scheme (from the existing `playcaller_specialty_split` in `coach-market.json`) and to archetype tags — it describes *which position the candidate understands best*, not the scheme they run.
- **Promotion path.** As the league ages, position coaches can be promoted to coordinators, and coordinators to HCs. Their specialty carries with them — a former QB position coach promoted to HC retains `QB` specialty. Promotion mechanics are out of scope for this doc (tracked alongside future coach-firings/hirings cycle).
- Specialty affects downstream systems (player development, scouting accuracy per position, scheme fit with roster), but those integrations are owned by the respective feature docs.

### Archetype

Every candidate has an **archetype** — a categorical tag describing how they operate in the role. See [`archetypes.md`](../product/north-star/archetypes.md) for the rating philosophy (orthogonal to quality, drive scheme fit and market pricing).

- Stored as a first-class column on `candidate`: `archetype` (ENUM, scoped by candidate kind).
- **HC archetypes:** `CEO`, `OFFENSIVE_PLAY_CALLER`, `DEFENSIVE_PLAY_CALLER`. Distribution sampled from `coach-market.json` `tiers.HC.playcaller_specialty_split` (currently `offense: 0.55`, `defense: 0.30`, `ceo: 0.15`).
- **Other role archetypes:** DoS, coordinators, position coaches, and scouts each have their own archetype set. Enumerations TBD — sourced from band files when authored; placeholder until then.
- Archetype is distinct from specialty (which position they know best) and from scheme (the system they run). A `DEFENSIVE_PLAY_CALLER` HC with `LB` specialty running a 3-4 scheme is three orthogonal axes.
- Archetype influences: how the HC delegates (a `CEO` leans harder on coordinators; an `OFFENSIVE_PLAY_CALLER` retains offensive play-calling), coordinator hiring behavior in `ASSEMBLING_STAFF`, and franchise scheme-fit scoring.

### Age & experience

Candidates carry realistic, band-driven age and experience data, both of which are visible to franchises during evaluation.

- **Age** — `candidate.age INT`. Sampled from the candidate's tier in the band file (`coach-market.json` / `scout-market.json` `age_distribution`). Modal HC age ~43 per current band; DoS and coordinator tiers have their own modes. Age ranges and tails are preserved from the source.
- **Total experience** — `candidate.total_experience_years INT`. Years the candidate has spent in the profession at any level (coaching or scouting, depending on kind). Sampled from `experience_distribution.years_experience_*` percentiles.
- **Role-level experience** — `candidate.experience_by_role JSONB`. A map of role → years, e.g. `{"HC": 0, "OC": 10, "QB_COACH": 4}` for a first-time HC candidate, or `{"DOS": 0, "SCOUT": 12, "AREA_SCOUT": 8}` for a first-time DoS. Values sum to ≤ `total_experience_years` (a year can cover multiple concurrent titles).
- Both the role breakdown and the total are shown in the candidate view. Explicitly supports the "10 years of coordinator experience, 0 years as HC" case — the first-timer rate (`first_time_hc_rate` in `coach-market.json`, currently 0.55) drives how often `HC` resolves to 0 in the breakdown.
- Generators produce consistent triples: `age`, `total_experience_years`, `experience_by_role` are sampled jointly so the distributions cohere (e.g. a 35-year-old cannot have 35 years of experience; a veteran retread cannot have 0 total years).

### Market dynamics & hidden ratings

The coach/scout market behaves like a stock market — the charter's core "market is the mechanic" framing ([`charter.md`](../product/north-star/charter.md) TL;DR). Candidate prices reflect perceived value, which is noisy relative to true rating. The user is hiring under uncertainty; this is the point, not a bug.

**Price-risk axis.**

- **Unproven, young candidates** — cheap (lower `compensation` target, lower `contract_length`, less leverage on guarantees). High variance on true rating — the pool contains both future Sean McVays and flame-outs. Sourced from the p10/mode salary bands for the tier.
- **Proven, older candidates** — expensive (p90/ceiling of salary band, longer deals, higher guarantees, retread buyout risk). Lower variance — prior HC/DoS years reduce the width of the true-rating distribution because you have a public track record to regress from. But reduced variance does not mean zero — proven coaches still bust (the coach-market notes list every high-profile retread including the failures).
- Price correlates with perceived value (age, total experience, prior role-specific experience, archetype scarcity, specialty fit with current league scheme demand) — not with true rating. Generator samples true rating independently, then derives a *scouted* rating with tier-specific noise.

**Hidden-info guarantee.**

- **True rating is never revealed.** Not in the pool view. Not after an interview. Not after hiring. The user works exclusively from the scouted signal for the entire lifetime of the candidate. See [`busts-and-gems.md`](../product/north-star/busts-and-gems.md) for the noise model across hidden populations.
- **Interviews reduce noise, they do not remove it.** An interview tightens the scouted estimate (lower σ around true rating) but the estimate is still noised. More interviews → tighter estimate → diminishing returns; the residual noise floor is tier-dependent and never reaches zero.
- **Post-hire observation is noisy too.** In-game performance is a function of the coach's true rating *and* roster, scheme fit, injuries, opponent quality, variance. A bad first season does not prove a bad hire; a great first season does not prove a great hire. User must decide when to fire under the same uncertainty they hired under.
- This is by design. The hidden-information pillar in the charter is the mechanism that makes every hiring decision a judgment call with real consequences — mirroring the real NFL, where mistakes happen constantly precisely because nobody ever truly knows.

**Generator contract.** The candidate generator for each tier (`HeadCoachGenerator`, `DirectorOfScoutingGenerator`, etc.) must:

1. Sample `true_rating` from the tier's underlying distribution.
2. Derive price signals (`compensation` target, `contract_length`, guarantees) from **perceived value only** — a function of age, experience, archetype, specialty, and the band file's `salary_annual_usd` percentiles. True rating does not enter the price function.
3. Derive `scouted_attrs` by applying tier-specific noise to the hidden attribute set.

Violating step 2 (letting true rating leak into price) collapses the market dynamic and is a bug.

---

## Ticks

A **tick** is any event that advances league state. Two kinds:

| Tick | Trigger | Scope |
|---|---|---|
| User action tick | User submits an action (start interview, make offer, hire) | User's franchise only. Pool updates (e.g. lock candidate in negotiation) are immediate and visible to CPU teams on the next week tick. |
| Week tick | User clicks "advance week" | Every CPU franchise executes one week of decisions via its `CpuFranchiseStrategy`. `phaseWeek` increments. Phase-completion check runs after. |

Phase transitions run as part of the week tick that satisfies completion. Transition hooks generate the next phase's candidate pool (if any) and reset per-franchise sub-state.

---

## Seams (interfaces)

Package-private inside the feature package unless cross-feature consumers appear. Constructor-injected. No concrete types in consumer code (ITDD).

| Interface | Responsibility |
|---|---|
| `AdvanceWeek` | Use case: run a week tick. Drives CPU strategies, increments `phaseWeek`, runs phase-completion check. |
| `AdvancePhase` | Use case: transition to next phase. Runs entry hooks (pool generation, sub-state reset). Called by `AdvanceWeek` on completion. |
| `CandidatePool` | Stores candidates per league per phase. Generated on phase entry, mutated as candidates are hired or locked. |
| `CandidateGenerator` | Generates a candidate pool for a given phase from band data. One implementation per candidate type (`HeadCoachGenerator`, `DirectorOfScoutingGenerator`). |
| `CpuFranchiseStrategy` | Per-phase CPU decision-maker. One implementation per phase (`CpuHiringStrategy` for both HC/DoS phases; `CpuStaffAssemblyStrategy` for `ASSEMBLING_STAFF`). Given league + franchise state, returns actions to apply. |
| `PhaseTransitionHandler` | Runs on phase entry/exit. One per phase. Creates candidate pool on entry, resolves unfilled hires (autofill) on exit. |
| `HiringRepository` | Per-franchise `HiringStep`, shortlist, active interviews. |
| `CandidatePoolRepository` | Persistence for candidate pools and candidates. |
| `CandidateOfferRepository` | Persistence for offers; queries active offers per candidate, per franchise, per week. |
| `OfferResolver` | At week tick, scores every candidate's active offers against `candidate_preferences` and applies accept/reject. |
| `FranchiseProfile` | Snapshot of a franchise's preference-relevant attributes (market size, geography, climate, prestige, window, etc.). Static fields from city data in v1; dynamic fields return equal-footing constants until the franchise-ratings doc lands. |

Feature-internal. Cross-feature access (e.g. from the future draft feature) goes through public use cases like `GetCurrentPhase`, not these seams directly.

---

## Persistence

### Schema additions

- `league.phase_week INT NOT NULL DEFAULT 1` — current week within the phase.
- `league_phase_max_weeks` — config table or constants; start with constants in code, move to DB when configurable.
- `candidate_pool` — `(id, league_id, phase, candidate_type, generated_at)`.
- `candidate` — `(id, pool_id, kind, hidden_attrs JSONB, scouted_attrs JSONB, hired_by_franchise_id NULL)`.
- `candidate_preferences` — wide table, one row per candidate. See [Candidate preferences](#candidate-preferences).
- `candidate_offer` — `(id, candidate_id, franchise_id, terms JSONB, submitted_at_week, status)`. Status: `ACTIVE`, `ACCEPTED`, `REJECTED`. Resolved at each week tick.
- `franchise_hiring_state` — `(franchise_id, phase, step, shortlist JSONB, interviewing_candidate_ids JSONB)`. Active offers are derived from `candidate_offer`.
- `franchise_staff` — `(id, franchise_id, role, candidate_id, scout_branch NULL, hired_at_phase, hired_at_week)` — terminal hires. Full role enum in [Org charts](#org-charts-nfl-baseline). `scout_branch` is populated only for `COLLEGE_SCOUT` / `PRO_SCOUT` rows.

Flyway migrations per logical change. Never edit applied migrations.

### Transactions

`@Transactional` on the use case (`AdvanceWeek`, `AdvancePhase`, individual user actions like `StartInterview`, `MakeOffer`). A week tick is one transaction — all CPU decisions commit or roll back together.

---

## Web layer

Per-phase dashboard views, composed from HTMX fragments. Separate URLs for full pages vs fragments per project convention.

| Phase | Page | Fragments |
|---|---|---|
| `INITIAL_SETUP` | `/leagues/{id}` (dashboard) | Intro card, `POST /leagues/{id}/advance` (runs a week tick; INITIAL_SETUP transitions immediately). |
| `HIRING_HEAD_COACH` / `HIRING_DIRECTOR_OF_SCOUTING` | `/leagues/{id}/hiring/{role}` | Candidate pool table, shortlist panel, active interview card, active negotiation card, week counter, `POST /leagues/{id}/advance`. |
| `ASSEMBLING_STAFF` | `/leagues/{id}/staff-recap` | League-wide staff hire recap, `POST /leagues/{id}/advance`. |

Dashboard (`/leagues/{id}`) is the default landing; it redirects or composes the active phase's view based on `league.phase`.

No JSON endpoints from web controllers. Fragment responses are `text/html`.

---

## Testing

- `@JooqTest` with Testcontainers for all repository + use-case tests. No `InMemoryCandidatePoolRepository` etc.
- Per CLAUDE.md: DB-touching tests always use real Postgres.
- `FakeRandomSource` for candidate generation determinism.
- `FakeClock` where timestamps matter.
- CPU strategies tested as interface implementations with deterministic inputs.
- Playwright E2E: one happy-path journey through `INITIAL_SETUP → HIRING_HEAD_COACH → HIRING_DIRECTOR_OF_SCOUTING → ASSEMBLING_STAFF`.

---

## Open items

- Interview capacity per week (default 3, tune later).
- `ASSEMBLING_STAFF` recap UX detail — which staff roles are hired by HC vs. DoS, and exact roster.
- Week cap values (`maxWeeks`) — current defaults are guesses; tune against playtest.
- ~~Autofill logic — pick best remaining candidate vs. random from remaining; needs decision.~~ Resolved (#608): autofill assigns the best remaining candidate by **scouted** overall (never true rating). Deterministic tie-break uses candidate id, then a seeded RNG split per-franchise. The autofill creates an `ACCEPTED` offer with default terms matching the candidate's preference targets and runs the standard hire wiring (mark hired, upsert `HIRED` state, insert `franchise_staff` row).

---

## Org charts (NFL baseline)

Zone Blitz mirrors NFL-equivalent staff structure. The canonical org charts below are synthesized from public front-office/coaches pages across five franchises (Bears, Lions, Eagles, Chiefs, 49ers) and inform what roles `ASSEMBLING_STAFF` must produce, what `franchise_staff.role` enum values exist, and what specialty/archetype sets each role draws from.

Adaptations from NFL for this league:

- **Owner seat is the user.** There is no separate "owner" role in the org chart — the user *is* the owner/GM hybrid (per charter design pillar 1).
- **GM role.** In NFL orgs, GM and DoS are often separate seats. For v1 the user absorbs GM-level decisions; **Director of Scouting** owns scouting operations beneath the user. No `GM` role in `franchise_staff`.
- **Director of Scouting scope.** Single DoS owns *both* college and pro scouting branches. DoS hires college scouts and pro scouts directly; the common NFL intermediate tier ("Director of College Scouting" / "Director of Pro Scouting") is collapsed into the DoS seat for v1.

### Coaching org

```
Head Coach (HC)
├── Offensive Coordinator (OC)
│   ├── Quarterbacks Coach
│   ├── Running Backs Coach
│   ├── Wide Receivers Coach
│   ├── Tight Ends Coach
│   └── Offensive Line Coach
├── Defensive Coordinator (DC)
│   ├── Defensive Line Coach
│   ├── EDGE / Outside Linebackers Coach   [may fold into DL or LB]
│   ├── Linebackers Coach
│   └── Defensive Backs Coach              [may split CB / S]
└── Special Teams Coordinator (ST)
```

**Variants observed across the league** (not v1 — noted for future scope):

- Assistant Head Coach (always dual-hatted on a position).
- Passing Game Coordinator / Run Game Coordinator (offensive and/or defensive, dual-hatted).
- Separate CBs vs. Safeties coaches.
- Offensive / Defensive / Special Teams Quality Control and Analyst roles.
- Head Strength & Conditioning + assistants (off-field pillar).
- Assistant position coaches (Asst QB, Asst OL, Asst WR, Asst DL, Asst LB, Asst DBs).

### Scouting org

```
Director of Scouting (DoS)
├── College Scouting branch
│   ├── National Scout          [cross-region, senior]
│   ├── Regional Scout          [optional intermediate tier]
│   └── Area Scout              [5-7 scouts covering NE, SE, SW, Midwest, West, etc.]
└── Pro Scouting branch
    └── Pro Scout
```

**Variants observed across the league** (not v1):

- Assistant Director of College Scouting / Assistant Director of Pro Scouting (intermediate manager tier).
- Co-Directors of College Scouting (branch split between two leads).
- Scouting Assistants.
- NFS / BLESTO combine scouts (third-party shared service).
- Football R&D / Analytics pillar (increasingly parallel to scouting under the GM).
- Player Personnel Coordinator (operations/support).

### Role enum (v1)

```
franchise_staff.role ENUM:
  HEAD_COACH
  OFFENSIVE_COORDINATOR
  DEFENSIVE_COORDINATOR
  SPECIAL_TEAMS_COORDINATOR
  QB_COACH
  RB_COACH
  WR_COACH
  TE_COACH
  OL_COACH
  DL_COACH
  EDGE_COACH
  LB_COACH
  DB_COACH
  DIRECTOR_OF_SCOUTING
  COLLEGE_SCOUT
  PRO_SCOUT
```

College and pro scouts are the same `kind = SCOUT` candidate at generation time but carry a `scout_branch` attribute (`COLLEGE` or `PRO`) reflecting how they operate — different evaluation inputs, travel patterns, and preference distributions. The DoS hires both branches in `ASSEMBLING_STAFF`.

### Default hires in `ASSEMBLING_STAFF` (v1)

Programmatic fills per franchise at phase entry, from the coach/scout market pool the HC/DoS draws from:

- **Coaching (HC hires):** 1× OC, 1× DC, 1× ST, 1× per position coach slot (QB, RB, WR, TE, OL, DL, EDGE, LB, DB) = 12 total.
- **Scouting (DoS hires):** 5× college scouts (by region), 3× pro scouts = 8 total.

Exact counts are tunable and captured under "Open items."

---

## Future considerations (not in v1 scope)

Realistic NFL hiring-cycle mechanics identified but deliberately deferred. Each can slot into the existing candidate / offer / preferences model without structural change.

- **Contract status & interview availability.** Candidates under contract elsewhere have interview windows tied to their current team's season state (e.g. coordinator on a playoff team unavailable until eliminated). Permission-required interviews. Models scarcity over time, not just across teams. Mostly irrelevant to inaugural league; matters year-2+.
- **Previous-role compensation floor.** Coaches don't take pay cuts. A candidate's `compensation` target has a hard floor derived from prior-role history in `experience_by_role`; first-time HCs demand meaningful raises over coordinator salary.
- **Packaged hires / "bring your guy" demands.** Hard requirement (stronger than `staff_continuity` preference): candidate carries a `packaged_demands` list of role slots they insist on filling themselves. Violated terms block acceptance regardless of score.
- **Bidding-war escalation.** At the week tick, before offer resolution, candidate signals "you have competition" and franchises with active offers get one chance to revise upward. Emergent compensation inflation mirrors real top-tier HC deals.
- **Candidate withdrawal.** Low-probability random event per week tick: candidate drops out for unstated reasons (family, health, late-opening rival, poor second-interview fit). UI shows "withdrew" without explanation.
- **Off-field red flags.** Hidden character/history risks (past firings for cause, DUI, coaching-tree drama). Surfaced with probability tied to scouting effort (DoS quality for scout hires; HC-tier diligence for coach hires). Independent bust signal distinct from rating noise.
- **Diversity / Rooney Rule analog.** League rule requiring N interviews from specified archetypes/backgrounds before `HIRED` is allowed. Fictional-league decision: whether and how to model.
- **Agent-mediated negotiation.** Candidates have agents with attributes (aggression, network). Agent noises compensation preference upward at negotiation time and shapes counter-offer behavior.
