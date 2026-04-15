# 0017 — League genesis as the default creation flow

- **Date:** 2026-04-15
- **Status:** Proposed
- **Area:** [League Genesis](../north-star/league-genesis.md),
  [League Management](../north-star/league-management.md)

## Context

Most franchise sims hand the user a league that already has fifty years of
fictional history. Zone Blitz's north-star vision is the opposite: every new
league is a brand-new startup league (XFL/UFL/AAF-style) that founds small,
grows via expansion, and generates its entire history from Year 1 forward.

[League Genesis](../north-star/league-genesis.md) documents this vision in
detail. This ADR ratifies the headline decision: _genesis is the canonical
creation flow, not an optional mode_. Every other genesis-related decision
(phase state machine, per-league unique coaches, allocation draft, expansion
voting, etc.) descends from this one.

## Decision

**Zone Blitz's canonical league-creation flow is League Genesis: a brand-new
startup league that founds with a small number of franchises (default 8), runs a
one-time genesis phase sequence, and grows via expansion over many seasons.**
Established-mode league creation (mature league with fictional pre-generated
history) remains available as a secondary path but is not the default and is not
where we invest product work first.

## Alternatives considered

- **Established mode as the default.** The pattern other franchise sims follow.
  Rejected because it forecloses the founding-era story that is Zone Blitz's
  most distinctive design bet, and because simulated pre-history produces a
  "borrowed" weight rather than one the user earned.
- **Both modes equal.** Supporting both paths as first-class experiences.
  Rejected because it doubles design and UI surface area and fragments follow-up
  ADRs (every genesis mechanic would need an established-mode parallel). Making
  genesis canonical keeps decisions coherent; established mode can be a
  derivative of the same systems.
- **Genesis as the only mode.** Simpler, but closes the door on users who
  explicitly want to drop into a mature league with immediate depth. Keeping
  established mode available preserves that option without investing in it as
  the default.

## Consequences

- **Makes easier:** coherent decision-making across north-star systems (staff
  hiring, drafting, salary cap, free agency, schedule) — each can optimize for
  the genesis flow and document deltas for the established path.
- **Makes easier:** onboarding. A founder-facing UI that walks through 8
  franchises, a handful of staff hires, and one allocation draft is less
  intimidating than 32 franchises and multiple drafts at creation time.
- **Makes harder:** the 32-team-league-day-one use case. Users who want the
  classic experience will need to opt into established mode and accept that it
  is the secondary path.
- **Follow-up work:** ADR 0018 (genesis phase state machine) and ADR 0019
  (inaugural Year 1 calendar) ratify the structural mechanics this decision
  implies. Additional ADRs will cover per-league unique coach/scout generation,
  contested staff hiring, founding pool composition, allocation-draft-only Year
  1, expansion by ownership vote, and early-league salary economics — tracked as
  follow-up issues.
