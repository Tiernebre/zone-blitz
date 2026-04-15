# 0019 — Inaugural Year 1 calendar (no preseason)

- **Date:** 2026-04-15
- **Status:** Proposed
- **Area:** [League Genesis](../north-star/league-genesis.md),
  [League Management](../north-star/league-management.md),
  [Game Simulation](../north-star/game-simulation.md),
  [0014 — Season calendar and phase state machine](./0014-season-calendar-phase-state-machine.md),
  [0018 — Genesis phase state machine](./0018-genesis-phase-state-machine.md)

## Context

Zone Blitz's canonical league-creation flow (ADR 0017) produces a brand-new
startup league with genesis-era phases running before Year 1 kickoff. The
recurring calendar documented in
[League Management](../north-star/league-management.md) assumes a mature league
with preseason, an established weekly cadence, and a 17-game season scaled for
32 teams.

That calendar doesn't apply verbatim to Year 1 of a genesis league. A startup
league has no preseason infrastructure (no stadium test runs, no media apparatus
for exhibition coverage, no prior-year schedule to reference) and an 8-team
league plays a compressed regular season. Without a ratified Year 1 calendar,
implementations will either run a nonsensical "preseason" in Year 1 or silently
skip phases the state machine still expects to visit.

## Decision

**Year 1 of a genesis league follows a distinct calendar:**

1. **Founding window** — the genesis phase sequence from ADR 0018 runs (charter
   → franchise establishment → staff hiring → founding pool → allocation draft →
   free agency → kickoff). This replaces the normal offseason.
2. **Brief training camp** — the single evaluation window before Week 1. Roster
   cuts happen here.
3. **No preseason games in Year 1.** The `PRESEASON` phase is skipped entirely
   the first time around; the clock advances directly from genesis kickoff into
   the regular season.
4. **Regular season scaled to league size** — an 8-team league defaults to
   ~10–12 games; schedule length is a league parameter, not a hard-coded 17.
   Plays on the standard weekly cadence.
5. **Playoffs and championship** — the first-ever playoffs and the first league
   championship.
6. **First real offseason (post-Year-1)** — the league enters the normal
   recurring calendar. The **first true rookie draft** happens here, ordered by
   Year 1 standings.

**Year 2 and beyond use the standard recurring calendar** documented in League
Management, including preseason, which the league now has the institutional
infrastructure to run. Genesis-era phases are one-shot and do not recur.

## Alternatives considered

- **Run a normal preseason in Year 1 too.** Consistent with Year 2+, and gives
  the sim an extra evaluation window. Rejected because it breaks the
  startup-league fiction (you don't have preseason stadiums booked in the same
  offseason you founded the franchise), and because an 8-team league running a
  4-game preseason + 12-game regular season + playoffs has too much abstracted
  football crammed into Year 1.
- **Skip preseason forever.** Rejected because preseason carries real mechanical
  weight in Year 2+ (depth-chart battles, bubble-player evaluation, cut-downs)
  that the league should have once the infrastructure exists. Year 1 is the
  exception, not the rule.
- **Hard-code a 17-game Year 1 regular season regardless of league size.**
  Rejected because it makes 8-team leagues play either absurdly repetitive
  schedules (every opponent ~2.4 times) or drawn-out seasons that dilute the
  novelty of founding-era football.

## Consequences

- **Makes easier:** the genesis narrative lands cleanly — founding, training
  camp, kickoff, season. No confusing exhibition-game block in the middle.
- **Makes easier:** scheduling — schedule length as a league parameter
  generalizes to expansion cycles (when the league grows from 8 to 12, the
  schedule naturally lengthens) without special cases.
- **Makes harder:** the phase state machine has to branch on
  `has_completed_genesis` (from ADR 0018) when advancing past kickoff: in Year 1
  it goes directly to REGULAR_SEASON, in Year 2+ it goes through PRESEASON. The
  advance-handler tests must cover both branches.
- **Makes harder:** stats normalization — Year 1 produces a shorter season so
  leaderboard thresholds and awards eligibility have to account for game count
  variability. This also applies to expansion-era seasons as the league grows.
- **Follow-up work:**
  - Implement the Year 1 → Year 2 calendar branch in the phase-advance handler
  - Surface `scheduleLength` as a league setting, driven by franchise count,
    with explicit override allowed
  - Update statistics systems to handle variable regular-season length (already
    partially implied by `[statistics.md]`'s genesis backlink)
  - UI: make Year 1's missing preseason explicit rather than silent — the
    season-overview screen should show "No preseason (inaugural year)" instead
    of an empty preseason tab
