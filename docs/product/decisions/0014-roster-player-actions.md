# 0014 — Roster player actions: ship Release first, defer Trade and Restructure

- **Date:** 2026-04-14
- **Status:** Accepted — implements the action set listed in
  [`0001-roster-page.md`](./0001-roster-page.md).
- **Area:** roster, contracts, salary cap — see
  [`../north-star/free-agency-and-contracts.md`](../north-star/free-agency-and-contracts.md),
  [`../north-star/salary-cap.md`](../north-star/salary-cap.md),
  [`../north-star/trading.md`](../north-star/trading.md).

## Context

The roster page (ADR 0001) lists three per-player actions — **Release**,
**Trade**, **Restructure** — and the buttons render today as disabled controls
in `client/src/features/league/roster.tsx`. The data model is already in place:
`contracts`, `playerTransactions` (with a `released` type), and
`contractHistory` (with a `released` termination reason) all exist in
`server/features/contracts/`. What's missing is the service layer and the
product decisions that shape what each action does in v1.

The three actions are not the same size of problem. Release is a one-team
action: remove player, recompute cap, log a transaction. Trade requires a
counterparty (CPU willingness, multi-asset packages including draft picks,
two-sided cap validation) — that's an entire flow, not a button. Restructure
requires a "how much base salary to convert" picker, restructure-window rules,
and a model for how often a contract can be touched. Bundling all three into one
ADR would either gloss over the hard calls in Trade/Restructure or block Release
on flows that aren't designed yet.

## Decision

Ship **Release** as the only functional action in this ADR. Trade and
Restructure buttons stay disabled with a "Coming soon" tooltip and get their own
ADRs (one each) before they're wired up.

Release is **always legal** at any point on the sim clock — same as the NFL,
where teams can cut players any day of the year. Cap consequences apply whenever
the cut happens; the rules don't gate the action.

A release is committed through a confirmation dialog that shows the cap impact
before the user confirms. No "undo" — once committed, the player is on the open
market.

## Requirements

### Trigger

- The Release button on a roster row opens a confirmation dialog. No inline-row
  commit, no bulk-select release in v1.
- Trade and Restructure buttons remain `disabled` with a tooltip ("Coming soon —
  see ADR 0014") so the absence is intentional, not broken.

### Confirmation dialog

Header: "Release {player name}?"

Body shows, computed from the current contract:

- **Dead cap this year** — remaining prorated signing bonus that accelerates
  onto this season's cap.
- **Cap savings this year** — base salary + roster/workout bonuses no longer
  owed.
- **Net cap change** — savings minus dead cap, signed.
- **Dead cap next year** — only relevant if a post-June-1 designation is used
  (see below); otherwise zero.
- **Cash still owed** — any fully guaranteed money the team still pays after the
  release.

Post-June-1 designation:

- Offered as a checkbox **only when the sim clock is before June 1 of the
  current league year**. After June 1, the designation is meaningless — show
  nothing.
- When checked, the dead cap splits across this year and next year per standard
  NFL rules. The dialog re-renders the two dead-cap rows live.
- No per-team cap on the number of post-June-1 designations in v1. (NFL caps it
  at two per team per year; we'll add the limit when it starts to matter for AI
  roster construction. Tracked as a follow-up issue.)

Confirm button is destructive-styled. Cancel closes the dialog with no state
change.

### Server effects on confirm

In a single transaction:

1. Mark the active row in `contracts` as terminated and update `contractHistory`
   with `terminationReason = 'released'` and the season year of the release.
2. Insert a `playerTransactions` row with `type = 'released'`,
   `teamId = <releasing team>`, `seasonYear`, `occurredAt = sim now`, and a
   `detail` payload capturing the cap impact shown in the dialog (dead cap,
   savings, post-June-1 flag) so the transaction log on the player detail page
   (ADR 0013) renders the same numbers the GM saw at confirm time.
3. Recompute and persist the team's cap state for the affected year(s).
4. Detach the player from the team and place them in the free-agent pool — the
   same pool the FA flow already reads from. Coach depth chart entries
   referencing the player are dropped (the coach sim re-publishes the chart on
   next tick per ADR 0001).

### Out of scope

- **Trade** — own ADR. Needs CPU willingness model, multi-asset packages,
  two-sided cap validation, conditional picks. Button stays disabled.
- **Restructure** — own ADR. Needs conversion picker, restructure window rules,
  per-contract restructure limits. Button stays disabled.
- **Re-signing a just-released player** — handled by the existing FA flow once
  the player is in the FA pool; no special re-sign affordance on the release
  confirm.
- **Per-team cap on post-June-1 designations** — follow-up issue.
- **Player morale / locker-room reaction** to the release — belongs to
  `free-agency-and-contracts.md`'s morale model when that lands.
- **Vested-veteran termination pay rules** — defer; treat all releases the same
  in v1.

## Alternatives considered

- **Wire all three actions in this ADR.** Rejected. Trade and Restructure are
  each large enough to need their own decisions doc; bundling them would either
  delay Release or paper over the hard calls.
- **Ship Release with no dialog, undo via a "reverse last move" affordance.**
  Rejected. Cap math on a release is not obvious from the row, and an undo
  affordance leaks into a "transactions are tentative" model that doesn't match
  the rest of the sim. The dialog is where the user sees the consequence; once
  confirmed, the move is real.
- **Gate releases to defined windows (offseason, cutdown, in-season).** Rejected
  for v1. NFL teams can release at any time; cap consequences are the gate, not
  the calendar. If we later need a cutdown moment for league pacing, that's a
  separate ADR.
- **Hide the Trade and Restructure buttons until they ship.** Rejected. Showing
  them disabled with a tooltip signals intent and matches what's already on
  screen — hiding them would be a visible regression from the current page.

## Consequences

- The roster page gets its first write action. Release exercises the full
  contract-termination path end to end (`contracts` → `contractHistory` →
  `playerTransactions` → cap recompute → FA pool), which de-risks the same path
  for Trade and Restructure later.
- The transaction-log row written here is the first real data the player detail
  page (ADR 0013) renders in its transaction-history section for a user-driven
  move. Detail-page consumers can rely on the `detail` payload being populated
  with the cap numbers shown at confirm time.
- The cap-recompute service called from the release handler is reusable — Trade
  and Restructure will both need it.
- Disabled Trade/Restructure buttons + ADR pointers create explicit follow-up
  work. File issues for: ADR for Trade actions; ADR for Restructure actions;
  per-team post-June-1 designation cap.
