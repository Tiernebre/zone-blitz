# 0036 — League-wide scouting allowances

- **Date:** 2026-04-16
- **Status:** Proposed
- **Area:** [Scouting](../north-star/scouting.md),
  [0034 — Genesis draft scouting phase](./0034-genesis-draft-scouting-phase.md),
  [0035 — Scouting advocacy and dissent event model](./0035-scouting-advocacy-dissent-event-model.md)

## Context

ADR 0034 commits to pre-draft visits, private workouts, and cross-check requests
being available to the GM during the scouting phase but leaves exact caps and
tuning to a follow-up ADR. ADR 0034 also commits to a strict competitive-parity
principle: every franchise gets the same structural resources; differentiation
comes from _who_ was hired in Phase 3, not from how much the GM can afford to
spend.

Without pinned numbers, NPC behavior, UI builders, and the allowance-spend UX
all stall. And without an explicit league-wide policy, there is no natural place
in the schema to store per-franchise counters that UI surfaces can read.

## Decision

Define three pre-draft allowances, **identical for every franchise in a given
league**, with defaults chosen to mirror real NFL practice. All three are league
settings — their defaults are hard-coded but their values are overridable at
league creation, with the constraint that the override applies uniformly to
every franchise.

### The three allowances

| Allowance            | Default cap per franchise | Available from |
| -------------------- | ------------------------- | -------------- |
| Pre-draft visits     | 30                        | Week 2 onward  |
| Private workouts     | 10                        | Week 2 onward  |
| Cross-check requests | 15                        | Week 2 onward  |

The **30 visits** default mirrors the NFL's "top-30 visits" rule. The **10
workouts** and **15 cross-checks** defaults are tuned to the phase length (4
weeks) and pool size (founding pool) to force prioritization without starving
the GM. All caps are per-phase totals; unused allowances do not roll forward
into any future phase.

### Caps are per franchise, not per scout

More scouts do not give you more visits. Better scouts do not give you more
cross-checks. What scout quality affects is the **signal density** of each
allowance's output — a better area scout extracts more from a visit; a better
cross-checker produces a more informative second opinion. The allowance count is
structural; the allowance value is earned through hiring.

This is load-bearing for ADR 0034's competitive-parity principle: a rich
franchise cannot buy more visits, and a cheap franchise is not starved of them.

### Cross-check fulfillment

A cross-check request targets a specific prospect and routes through the
scouting director. The director assigns an available cross-checker from the
franchise's staff. If the franchise has **no cross-checker on payroll**, the
request is "parked" with an explicit GM-visible blocker: "No cross-checker on
staff to fulfill this request." The request consumes no allowance until it
resolves. This is an observable consequence of under-hiring the scouting
department during Phase 3.

Resolved cross-checks emit a `cross_check_resolved` event (per ADR 0035) 2–5
simulated days after the request.

### Scheduling granularity

Visits and workouts consume a simulated-day slot on the phase's internal 4-week
× 7-day micro-calendar. Multiple allowances can fit into one simulated day,
subject to a small per-day cap (3 visits or 1 workout) that reflects real travel
constraints. Each prospect can be visited at most once and worked out at most
once by any given franchise.

### NPC consumption

NPC franchises spend their allowances as part of their scouting AI (downstream
ADR). The caps apply to NPCs identically — the NPC AI does not get a hidden
boost.

## Alternatives considered

- **GM can purchase additional allowances with budget.** Rejected: explicitly
  violates the competitive-parity principle from ADR 0034. "Outspending" has no
  path to a scouting advantage.
- **Variable per-franchise caps based on franchise reputation or market size.**
  Rejected: reputation is a mature-league concept with no baseline in genesis,
  and introducing a variable cap now contradicts the structural parity the
  genesis phase commits to.
- **Unlimited allowances.** Rejected: scarcity of scouting attention is exactly
  the tradeoff that makes the phase interesting. Unlimited allowances collapse
  the strategic decision of _which_ prospects deserve a visit.
- **Per-scout allowances (each scout gets N visits).** Rejected: creates
  bookkeeping burden without corresponding strategic depth. The GM operates at
  the franchise level; internal scout-to-prospect assignment is not a GM
  decision (per ADR 0034).
- **Roll over unused allowances to the allocation draft phase.** Rejected: no
  mechanism in the draft phase consumes them, and rollover invites hoarding that
  empties the scouting phase of activity.

## Consequences

- **Parity is enforced at the data layer.** A single
  `league_scouting_allowances` settings row per league, plus per-franchise
  counters on `franchise_scouting_state`, make it impossible for any franchise
  to exceed the cap.
- **Allowance UI is simple.** Three counters, a scheduling micro-calendar, and a
  "no cross-checker on staff" blocker when applicable. No pricing, no budget
  field.
- **Hiring decisions in Phase 3 pay off here.** Cross-checker quality,
  area-scout-to-prospect fit, and director quality all shape the _value_ of each
  allowance. The allowance count is fixed; the payoff is not.
- **Caps are tunable league-wide but not per-franchise.** Post-MVP, a league
  creator can loosen or tighten caps to suit league philosophy; the parity
  constraint is preserved because every franchise sees the same new cap.
- **Follow-up work:**
  - Add `league_scouting_allowances` with the three cap columns and sane
    defaults.
  - Add `franchise_scouting_state` with per-phase counters.
  - Add `scouting_visits`, `scouting_workouts`, `cross_check_requests` tables
    keyed by franchise + prospect + simulated-day slot.
  - Wire the cross-check director routing logic (including the "no cross-checker
    on staff" blocker).
  - Surface the allowance counters in the scouting phase UI.

## Related decisions

- [0034 — Genesis draft scouting phase](./0034-genesis-draft-scouting-phase.md)
- [0035 — Scouting advocacy and dissent event model](./0035-scouting-advocacy-dissent-event-model.md)
