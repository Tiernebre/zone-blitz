# 0014 — Season calendar and phase state machine

- **Date:** 2026-04-15
- **Status:** Proposed
- **Area:** league management — see
  [`../north-star/league-management.md`](../north-star/league-management.md);
  cross-cuts [`../north-star/salary-cap.md`](../north-star/salary-cap.md),
  [`../north-star/drafting.md`](../north-star/drafting.md), and
  [`../north-star/free-agency-and-contracts.md`](../north-star/free-agency-and-contracts.md).

## Context

Nothing else in the game can be decided without a shared notion of _what phase
the league is in_ and _what advances the clock_. Drafting, free agency, contract
mechanics (tags, tenders, extensions), trading, cap-compliance deadlines, and
statistical accumulation all branch on phase. The north-star sketches the season
calendar (offseason → preseason → regular → playoffs → awards) but does not
commit to a state machine, a granularity, or a trigger model. Without that
commitment, every downstream ADR has to re-invent a time model.

The north-star also leaves multiplayer season advancement as an open menu
(commissioner-controlled, ready-check, scheduled, hybrid). We need to pick a
default so single-player and multiplayer share one code path and so the cap
compliance deadline (salary-cap north-star) is representable.

## Decision

Model the league clock as an **explicit, ordered phase state machine** on a
single `league_clock` row per league, advanced by a **user-initiated advance
action** ("advance to next step"), never by a wall-clock daily tick. The unit is
an opaque **phase step** — some steps represent a single event (the draft, the
trade deadline), others represent a week of games (regular-season week 3).
Calendar dates are labels, not the substrate.

Concretely:

1. **Phases are a typed enum** with a deterministic order. Each phase owns its
   own set of steps.
2. **One league-wide clock.** `league_clock` holds `phase`, `stepIndex`,
   `seasonYear`, and `advancedAt`. A `league_phase_step` catalog enumerates the
   steps inside each phase so new deadlines can be added without schema changes.
3. **Advance is a user action**, not a cron. In single-player the controlling GM
   presses _Advance_. In multiplayer the commissioner advances by default, with
   an opt-in ready-check policy per league. A background scheduler is explicitly
   out of scope for v1.
4. **Transitions are gated.** Moving _into_ regular season requires all teams
   cap-compliant and rostered to the active-roster limit. Non-compliant human
   teams block the advance; non-compliant NPC teams are auto-resolved. Gates are
   pure functions over league state, not ad-hoc checks scattered across
   features.
5. **Deadlines are steps, not dates.** "Franchise tag deadline," "RFA tender
   deadline," "final cuts," and "trade deadline" are each a named step in the
   phase-step catalog. The player sees a calendar-looking date for flavor, but
   the system reasons only about step ordering.

## Phase enum (v1)

```ts
export const LEAGUE_PHASE = {
  offseasonReview: "offseason_review", // awards, end-of-year recap, HoF
  coachingCarousel: "coaching_carousel", // firings, hires, coordinator moves
  tagWindow: "tag_window", // franchise/transition tag deadline falls here
  restrictedFA: "restricted_fa", // RFA tender + matching window
  legalTampering: "legal_tampering", // UFA negotiation, no signings
  freeAgency: "free_agency", // UFA signings open; cap compliance deadline
  preDraft: "pre_draft", // combine recap, pro days, visits
  draft: "draft", // the draft itself (rounds advance as steps)
  udfa: "udfa", // post-draft UDFA signing period
  offseasonProgram: "offseason_program", // OTAs/minicamp (abstracted)
  preseason: "preseason", // roster battles, cut-downs to 53
  regularSeason: "regular_season", // weekly steps; trade deadline is a step
  playoffs: "playoffs", // WC / DIV / CONF / SB as steps
  offseasonRollover: "offseason_rollover", // contract expirations, cap rollover, year++
} as const;
```

Fourteen phases. `offseasonRollover` is a distinct terminal phase rather than
implicit year-end bookkeeping — it is the single place where the season advances
(`seasonYear++`), contracts expire, cap rolls forward, and the machine loops to
`offseasonReview` of the next year. Keeping it explicit makes it a testable,
auditable transaction.

## Granularity: phase + step

The atomic unit is the **step**, not the day. A step is one of:

- a single **event** (draft round, trade deadline, tag deadline, final cut day,
  compliance deadline)
- a **week of games** (regular-season week N, playoff round)
- a **content block** (legal-tampering window, UDFA signing period) whose
  internal duration does not matter to the sim

This sidesteps modeling every calendar date. "March 4, 4pm ET" becomes "step
`tag_deadline` inside phase `tag_window`." The UI can render a synthetic
NFL-style date next to the step for flavor; the engine never reads it.

## Schema sketch

```ts
// server/features/league-clock/league-clock.schema.ts
export const leagueClock = pgTable("league_clock", {
  leagueId: uuid("league_id")
    .primaryKey()
    .references(() => leagues.id, { onDelete: "cascade" }),
  seasonYear: integer("season_year").notNull(), // e.g. 2026
  phase: leaguePhaseEnum("phase").notNull(),
  stepIndex: integer("step_index").notNull().default(0),
  advancedAt: timestamp("advanced_at").defaultNow().notNull(),
  advancedByUserId: uuid("advanced_by_user_id").references(() => users.id),
});

// Step catalog — per-phase ordered steps with optional deadline semantics.
// Seeded at migration time, editable by commissioner tools later.
export const leaguePhaseStep = pgTable("league_phase_step", {
  id: uuid("id").primaryKey().defaultRandom(),
  phase: leaguePhaseEnum("phase").notNull(),
  stepIndex: integer("step_index").notNull(),
  slug: text("slug").notNull(), // e.g. "tag_deadline", "week_3", "trade_deadline"
  kind: stepKindEnum("kind").notNull(), // 'event' | 'week' | 'window'
  flavorDate: text("flavor_date"), // synthetic NFL-style label, nullable
});

// Ready-check for multiplayer. Empty table in single-player.
export const leagueAdvanceVote = pgTable("league_advance_vote", {
  leagueId: uuid("league_id").references(() => leagues.id, {
    onDelete: "cascade",
  }),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
  phase: leaguePhaseEnum("phase").notNull(),
  stepIndex: integer("step_index").notNull(),
  readyAt: timestamp("ready_at").defaultNow().notNull(),
});
```

The `league` row itself carries no clock fields — the clock is its own
aggregate. `league_phase_step` is a catalog, not per-league state, so adding a
new deadline is a seed update, not a migration.

## Transitions and gating

Advancement is a single service: `advanceLeagueClock(leagueId, actor)`. It (a)
computes the next `(phase, stepIndex)` from the catalog, (b) runs the gate
function for that transition, (c) runs the effect function (simulate the week,
resolve the deadline, expire contracts, etc.) inside one transaction, (d) writes
the new clock row.

Gates are pure `(leagueState) => GateResult` where `GateResult` is
`{ ok: true }` or `{ ok: false, blockers: Blocker[] }`. Examples:

- **Enter `regularSeason`**: every team cap-compliant at the configured deadline
  cap, every team at active-roster limit. Human blockers surface as UI warnings;
  NPC blockers trigger auto-cut / auto-restructure before the gate is
  re-evaluated.
- **Enter `draft`**: prior phase complete, draft order resolved.
- **Enter `offseasonRollover`**: Super Bowl played.

A **commissioner override** exists for every gate. In single-player the
controlling GM is implicitly the commissioner. Overrides are logged on the clock
row so league history can render "commissioner advanced past cap compliance with
2 non-compliant teams."

## Multiplayer vs. single-player

- **v1 default for both modes:** commissioner-advances (single-player GM _is_
  the commissioner). One model, one code path.
- **v1 opt-in:** per-league `advancePolicy: 'commissioner' | 'ready_check'`.
  Ready-check requires every active human GM to cast a vote in
  `league_advance_vote` for the current `(phase, stepIndex)` before
  `advanceLeagueClock` will accept a non-commissioner trigger. Commissioner can
  always force-advance.
- **Deferred past v1:** wall-clock scheduled advancement ("advance every 48
  hours"), live-draft real-time pick timers, free-agency real-time bidding.
  These are layered on top of the same state machine — the scheduler eventually
  calls `advanceLeagueClock` on a timer — so the data model does not need to
  change to support them.

Absent-manager handling (auto-pilot NPC takeover) is orthogonal: if a human team
has `autoPilot = true`, it is treated as NPC for gate-blocker resolution and for
ready-check (auto-votes ready).

## Alternatives considered

- **Daily tick with real calendar dates.** Model time as an in-game date
  advanced one day at a time, with deadlines as date triggers. Rejected: forces
  us to decide whether "March 4" means anything in a league configured for a
  20-game season or custom cap year, and doubles the rendering surface (a date
  that the engine uses _and_ a date shown to the user). Step-based granularity
  with flavor-date labels gets the UX benefit without entangling the engine with
  the Gregorian calendar.
- **Single monolithic `phase` enum flat across events and weeks (no steps).**
  Rejected: would require minting a phase for every regular-season week and
  every deadline, bloating the enum to 40+ values and making "where are we
  inside free agency?" un-modelable. Two-level (phase + step) keeps the
  high-level enum legible and pushes variability into a data-driven catalog.
- **Event-sourced clock (append-only `league_events` log, derive current
  phase).** Rejected for v1: powerful for audit and rewind, but adds a
  projection layer before anything else can read "what phase are we in." Current
  `(phase, stepIndex)` as a materialized row is simpler; we can layer an event
  log on top later without breaking callers.
- **Separate clocks per team / per feature** (draft has its own clock, FA has
  its own clock). Rejected: the whole point is a shared notion of time.
  Splitting clocks re-creates the problem this ADR exists to solve.
- **Automatic wall-clock daily tick as the v1 default.** Rejected: forces a
  background worker, a scheduler, and timezone handling into v1 for a
  single-player experience where the user explicitly wants to play at their own
  pace. The north-star mode description leads with "advance the season whenever
  you're ready." Scheduled advancement is a v2 feature that wraps this ADR, not
  a substitute for it.
- **Let each feature own its own deadline table** (FA has `fa_deadlines`, cap
  has `cap_deadlines`, etc.). Rejected: each would reinvent ordering and gating,
  and cross-feature invariants (cap compliance deadline is the gate into regular
  season) would have no natural home.

## Consequences

- **Unblocks the downstream product ADRs** that have been waiting on a time
  model: drafting (draft phase / round-by-round step advancement), free agency
  (legal-tampering + FA phases, tag and tender deadlines), contracts (expiration
  at `offseasonRollover`, cap compliance gate), trading (trade deadline as a
  step inside `regularSeason`), statistics (stats accrue on `week_N` step
  execution).
- **One code path for both modes.** Single-player is commissioner-advances with
  a trivial commissioner. Multiplayer adds ready-check via an opt-in policy. No
  forked engine.
- **Cap compliance has a concrete home.** ADR 0010's non-compliant Cap Hell
  starting state resolves at the gate entering `regularSeason`; until that gate
  the team can be over the cap.
- **Deadline mechanics are data, not code.** Adding a new deadline is a new row
  in `league_phase_step`, not a new column or migration. Commissioner tooling to
  reorder/rename steps becomes a natural extension.
- **League history gets a free audit trail.** Every advance writes a clock row;
  an append-only `league_clock_history` table (follow-up) makes "replay the
  season" a query.
- **Follow-ups not in this ADR:**
  - Per-step **effect registry** — mapping each step slug to the function that
    executes its effect (simulate week, run draft round, cut to 53). The
    registry is where most engine work will land; this ADR commits only to the
    dispatch shape.
  - **`league_clock_history`** append-only table for audit + rewind.
  - **Scheduled advancement** (wall-clock tick) as a v2 wrapper that calls
    `advanceLeagueClock` on a timer.
  - **Per-phase UI shells** — each phase likely needs its own landing view; that
    is a UI ADR, not this one.
  - **Gate function catalog** — formalize the `(leagueState) => GateResult`
    contract and enumerate the v1 gates. Likely one ADR per gated transition
    (cap compliance, roster size, draft order resolved).
  - **Conditional-pick resolution timing** — Pro Bowl / awards-based conditions
    need a deterministic resolution step in `offseasonReview`; defer to the
    contracts ADR.
