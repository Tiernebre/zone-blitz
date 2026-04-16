# 0032 — Multi-week staff hiring process

- **Date:** 2026-04-16
- **Status:** Accepted
- **Area:** [Coaches](../north-star/coaches.md),
  [Scouting](../north-star/scouting.md),
  [League Genesis](../north-star/league-genesis.md),
  [0014 — Season calendar and phase state machine](./0014-season-calendar-phase-state-machine.md),
  [0023 — Contested staff hiring market](./0023-contested-staff-hiring-market.md)

## Context

ADR 0023 describes _how_ the contested staff market resolves (candidate
preferences, parallel bidding, iterative rounds) but treats timing as implicit —
hiring is a single atomic phase with no notion of simulated weeks. The
north-star coaching doc envisions interviews, negotiations, and candidate
decision-making as a lived experience, not an instant transaction. ADR 0014's
phase state machine provides multi-step granularity inside every phase, but no
ADR formalizes the step catalog for hiring.

An instant hiring phase misses the gameplay that makes staff decisions
interesting: scouting a candidate before committing, losing a target because you
hesitated, poaching a coordinator mid-interview cycle, or scrambling to fill a
vacancy after your top choice signs elsewhere. The hiring timeline should feel
like a compressed version of a real coaching search — measured in weeks, not
clicks.

## Decision

Staff hiring — during both the genesis `GENESIS_STAFF_HIRING` phase and the
recurring `coaching_carousel` phase — proceeds across **multiple simulated
weeks**, each modeled as a step in ADR 0014's phase-step catalog. Each week
represents a distinct stage of the hiring process where candidates and
franchises interact.

### Hiring timeline (steps within the phase)

1. **Openings & market survey (Week 1).** Fired coaches and vacated positions
   become public. The full candidate pool is revealed. For each candidate,
   franchises see resume, reputation, scheme preference, and personality
   impressions — the same opaque signals described in the coaches north-star
   doc. Franchises may designate **interest** in up to N candidates (a soft cap
   that forces prioritization). No binding offers yet.

2. **Interview window (Weeks 2–3).** Franchises request interviews with
   candidates they expressed interest in. Each franchise can conduct a limited
   number of interviews per week (representing bandwidth — you can't interview
   everyone). Interviews surface additional signal: coaching philosophy details,
   staff-fit impressions, and scheme-specific depth. Candidates may decline
   interview requests from franchises that don't meet a minimum preference
   threshold (per ADR 0023's "candidates can refuse" rule).

3. **Offer window (Week 4).** Franchises submit binding contract offers to
   interviewed candidates. Each franchise may extend offers to multiple
   candidates but must honor every offer if accepted — cap and budget
   implications are real. Offer terms include salary, length, and incentive
   structure (per the coaches north-star's contract section).

4. **Candidate decision (Week 5).** Candidates evaluate all offers using their
   hidden preference function (ADR 0023: market tier, philosophy fit, existing-
   staff fit, compensation). Candidates who received multiple offers choose the
   best match. Candidates who received no offer above their minimum threshold
   remain unsigned. Results are revealed to all franchises simultaneously.

5. **Second wave (Weeks 6–7, optional).** Franchises with unfilled mandatory
   positions and unsigned candidates re-enter a compressed interview + offer
   cycle. This second wave is two steps: one for interviews and one for offers
   and decisions. The compressed timeline reflects real-world urgency — you're
   hiring from the leftovers and both sides know it.

6. **Finalization (Week 8).** Any franchise still missing a mandatory staff
   position is auto-assigned the best available unsigned candidate (NPC teams)
   or shown a "must hire" gate blocker (human teams) that prevents phase advance
   until filled. The phase cannot complete with unfilled mandatory slots.

### Genesis vs. recurring-season differences

- **Genesis (`GENESIS_STAFF_HIRING`):** Every franchise starts with a completely
  empty staff. The candidate pool is larger (enough candidates for all
  franchises to fill every mandatory role). The full 8-step timeline runs.
  Genesis hiring is the first significant decision point after franchise
  establishment.

- **Recurring season (`coaching_carousel`):** Only franchises with vacancies
  participate. The candidate pool is the union of fired coaches, retiring
  coaches re-entering, coordinators seeking promotion, and newly generated
  candidates. If no franchise has a vacancy, the phase auto-advances in a single
  step.

### User decisions at each stage

| Stage            | User action                                               |
| ---------------- | --------------------------------------------------------- |
| Market survey    | Browse candidates, designate interest list                |
| Interview window | Select which candidates to interview (limited slots)      |
| Offer window     | Set contract terms, choose which candidates to offer      |
| Decision reveal  | Review results — who signed, who was lost to a competitor |
| Second wave      | Repeat interview/offer for unfilled positions             |
| Finalization     | Fill any remaining mandatory slots                        |

### Interaction with league advancement

Each hiring week is a **step** in the phase-step catalog (ADR 0014). The
controlling GM (or commissioner in multiplayer) advances through steps using the
same mechanism as every other phase. In multiplayer with ready-check enabled,
all human GMs must be ready before advancing past each hiring step — ensuring no
one is rushed through their interview decisions.

Between hiring steps, NPC franchises execute their hiring AI: expressing
interest, requesting interviews, and submitting offers according to their
personality and philosophy (per ADR 0023's NPC behavior rules).

### Staff covered

This hiring process applies to both **coaches** (HC, coordinators, position
coaches) and **scouts** (scouting director, national cross-checkers, area
scouts). Both staff types are hired from the same shared candidate pool during
the same 8-step timeline. A franchise manages both coaching and scouting hires
simultaneously within each step — expressing interest in coaches and scouts,
interviewing both, offering both.

A "candidate" is any coach or scout not currently signed to a team (`teamId` is
null). No separate candidate entity is needed.

### Staff budget

All coaching and scouting salaries are funded from a fixed **staff budget** — a
league-wide setting, identical for every team, completely separate from the
player salary cap. Spending less on staff does not free up player cap room, and
vice versa. The level playing field ensures that franchise success in the hiring
market is driven by prioritization and philosophy fit, not by outspending
opponents.

- **Default staff budget:** $50,000,000 per team per season (configurable league
  setting).
- **What counts:** Annual base salaries of all coaches and scouts on the team's
  payroll, plus buyouts for fired staff in the year they are triggered.
- **Offer validation:** A franchise cannot submit an offer whose salary, when
  added to existing staff obligations, would exceed the staff budget.

### Salary bands

Salary ranges for offer validation and NPC AI behavior, aligned to real NFL
2025–26 coaching market data:

| Role                      | Floor | Ceiling | Contract years |
| ------------------------- | ----- | ------- | -------------- |
| HC (elite / established)  | $12M  | $20M    | 4–6            |
| HC (first-time)           | $5M   | $10M    | 3–5            |
| Offensive coordinator     | $1.5M | $6M     | 2–4            |
| Defensive coordinator     | $1.5M | $5M     | 2–4            |
| Special teams coordinator | $800K | $2M     | 2–3            |
| QB coach                  | $500K | $1.5M   | 1–3            |
| Other position coach      | $300K | $1.2M   | 1–3            |
| ST assistant              | $250K | $600K   | 1–2            |
| Director of scouting      | $250K | $800K   | 3–5            |
| National cross-checker    | $150K | $400K   | 2–4            |
| Area scout                | $80K  | $200K   | 1–3            |

A full staff (13 coaches + 7 scouts) at mid-range salaries totals roughly
$25M–$35M, leaving headroom in a $50M budget for elite hires or buyout
absorption. A team that goes all-in on an elite HC and top coordinators will
feel real pressure on position coach and scout spending.

### Offer structure

When a franchise submits a binding offer during the offer window, the offer
includes:

- **Salary** — annual base compensation.
- **Contract years** — length of the deal.
- **Buyout multiplier** — a value between 0.5 and 1.0 that determines the firing
  cost: `salary × remaining years × multiplier`. A higher multiplier means more
  protection for the coach (and more risk for the franchise).
- **Incentives** — an optional set of performance bonuses: playoff appearance,
  division title, championship, player development milestones, and win
  thresholds. Incentives factor into the candidate's preference evaluation — a
  candidate with a high compensation preference values a rich incentive package
  on a contending team more than base salary alone.

### Season vs. offseason constraints

- **Offseason coaching carousel:** The full multi-week hiring timeline runs.
  This is the primary hiring window.
- **Mid-season vacancies (fired mid-season):** A franchise that fires a coach
  during the regular season may only hire an **interim** from their existing
  staff or from the unsigned candidate pool. Interim hires skip the full
  timeline — they are a single-step emergency appointment. The permanent
  replacement search happens in the next offseason's coaching carousel.
- **Position coach vacancies during the season** (poaching, resignation): Filled
  immediately from internal staff or unsigned candidates. No multi-week process
  — these are operational hires, not marquee searches.

## Alternatives considered

- **Instant atomic hiring (status quo).** All hiring resolves in a single
  advance action with no intermediate steps. Simpler to implement but eliminates
  the strategic depth of timing, interview limits, and competing offers. The
  user never experiences the tension of losing a candidate to a rival. Rejected
  because it reduces the most consequential offseason decision to a menu
  selection.

- **Real-time countdown timers per hiring step.** Each step lasts N real-world
  minutes, forcing urgency. Appealing for multiplayer drama but hostile to
  single-player pacing and async multiplayer. Rejected for v1; compatible as a
  future layer on top of the step-based model (the step catalog doesn't care
  whether advance is user-initiated or timer-driven).

- **Unlimited interviews and offers (no bandwidth cap).** Franchises can
  interview and offer every candidate simultaneously. Eliminates the
  prioritization decision — you never have to choose who to pursue first.
  Rejected because scarcity of attention is what creates interesting tradeoffs
  (do you chase the elite HC or lock down coordinators first?).

- **Single-round hiring with no second wave.** If you miss your top choice, you
  wait until next offseason. Punishing for new players who misjudge the market.
  Rejected because the second wave is a safety valve that prevents a bad hiring
  round from crippling a franchise for an entire season.

## Consequences

- **Hiring becomes a multi-step strategic minigame.** The user's interview
  choices, offer timing, and fallback plans matter. This is aligned with the
  coaches north-star's vision of hiring as a consequential, uncertain process.

- **The phase-step catalog for `coaching_carousel` and `GENESIS_STAFF_HIRING`
  must be seeded.** Each hiring week becomes a row in `league_phase_step` with
  slugs like `hiring_market_survey`, `hiring_interview_1`, `hiring_interview_2`,
  `hiring_offers`, `hiring_decisions`, `hiring_second_wave_interview`,
  `hiring_second_wave_decisions`, `hiring_finalization`.

- **NPC hiring AI must operate per-step, not per-phase.** The AI described in
  ADR 0023 must be decomposed into per-step behaviors: express interest, request
  interviews, submit offers. This is more complex but produces more realistic
  and readable NPC behavior.

- **Interview and offer limits become tunable league settings.** Different
  leagues may want tighter or looser hiring constraints. The step catalog is
  fixed but the bandwidth caps (interviews per week, concurrent offers) can be
  league parameters.

- **Mid-season coaching changes are intentionally limited.** The interim-only
  rule for mid-season firings creates a real cost to firing a coach during the
  season — you're stuck with a stopgap until the offseason carousel. This
  mirrors real NFL dynamics and makes the firing decision weightier.

- **Follow-up work:**
  - Add preference columns (`market_tier_pref`, `philosophy_fit_pref`,
    `staff_fit_pref`, `compensation_pref`, `minimum_threshold`) to both the
    `coaches` and `scouts` tables. Add hiring workflow tables
    (`hiring_interests`, `hiring_interviews`, `hiring_offers`,
    `hiring_decisions`) with a `staff_type` discriminator for polymorphic
    references.
  - Seed the `league_phase_step` rows for both `coaching_carousel` and
    `GENESIS_STAFF_HIRING` phases with the 8-step hiring timeline.
  - Add `staff_budget`, `interest_cap`, `interviews_per_week`, and
    `max_concurrent_offers` as league settings.
  - Implement the candidate preference function (ADR 0023: market tier,
    philosophy fit, staff fit, compensation weighted scoring).
  - Implement per-step hiring service logic with staff budget validation.
  - Implement per-step NPC hiring AI (interest → interview → offer decisions).
  - Design the hiring UI: candidate browsing, interview request, offer builder,
    decision-reveal screen.
  - Wire step-advance hooks so NPC actions and candidate decisions execute
    automatically on clock advance.
  - Wire the `hiring_finalization` step's gate function to enforce mandatory
    staff requirements before phase advance.
  - Adjust scout salary bands in the generator to match realistic NFL ranges
    (current bands are significantly inflated).

## Related decisions

- [0014 — Season calendar and phase state machine](./0014-season-calendar-phase-state-machine.md)
- [0023 — Contested staff hiring market](./0023-contested-staff-hiring-market.md)
- [0018 — Genesis phase state machine](./0018-genesis-phase-state-machine.md)
