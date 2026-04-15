# 0029 — Default 8 founding franchises with no count selector in MVP

- **Date:** 2026-04-15
- **Status:** Accepted
- **Area:** [League Genesis](../north-star/league-genesis.md)

## Context

[League Genesis](../north-star/league-genesis.md) calls for a small founding
league — 8 franchises by default, configurable down to 4 or up to a larger
custom number — with expansion as the long-run path to 32 and beyond. The
north-star doc treats the count as configurable; ADR 0028 locks all settings as
readonly for the MVP.

This ADR exists to pin down the specific case of franchise count, because it
shapes more than any other single setting:

- The team-select screen (ADR 0027 step 2) needs a concrete list of founding
  franchises to present.
- The founding player pool needs to be sized for a specific number of rosters.
- The generation step (ADR 0030) needs to know how many NPC franchises and their
  coaching staffs to create.
- The schedule length, division structure, and playoff bracket in ADR 0028's
  settings preview are all derived from the franchise count.

Leaving the count variable — even behind a readonly input — would imply that a
future "unlock this" switch changes one number. It doesn't; it changes the whole
downstream generation pipeline.

## Decision

**Every MVP-created league has exactly 8 founding franchises. There is no
founder-facing control for franchise count — not even a disabled one — in the
MVP wizard.** The count is a hardcoded constant in the creation pipeline and in
the settings preview screen's derived values (schedule length, division
structure, etc. are all stated against the 8-team assumption).

Expansion remains the long-run path to larger league sizes, per the north-star
doc and ADR 0025. The MVP ships with no expansion UI either, but nothing in this
ADR forecloses it.

## Alternatives considered

- **Expose franchise count as a readonly input per ADR 0028's pattern.**
  Consistent with the rest of the settings screen, but misleading: every other
  readonly input is a value whose edit would be a small follow-up, while
  franchise count is structurally different — making it editable is a
  significant systems project (generation, team-select, schedule, divisions,
  allocation draft all parameterize on it). Omitting it from the settings screen
  is more honest about that.
- **Expose franchise count as the one editable setting in the MVP.** The
  opposite extreme. Rejected because the defaults for schedule length, division
  structure, and playoff bracket were tuned against 8; letting the founder pick
  12 or 16 at creation time means every derived default either needs its own
  scaling logic or produces a visibly mis-tuned league.
- **Support a small set of franchise-count presets (e.g., 6, 8, 12).** Cleaner
  than free-form input and less scope than "configurable." Still a meaningful
  systems project for MVP, and the north-star's recommended default is
  already 8. Deferred until we have a real reason to offer more.

## Consequences

- **Makes easier:** every downstream system that currently parameterizes on
  franchise count. For the MVP they can take 8 as a constant.
- **Makes easier:** generating a plausible team-select screen (ADR 0027 step 2).
  The pool of founding franchises surfaced to the founder is exactly 8 branded
  teams, one of which they'll claim and seven of which become NPC franchises.
- **Makes easier:** calibrating the founding player pool size, the schedule
  length, and the division structure. Each has a single target to design
  against.
- **Makes harder:** founders who want a bigger or smaller league on day one.
  They can't have one. The intent is that expansion (ADR 0025) is the long-run
  answer, and the MVP simply doesn't ship expansion yet.
- **Follow-up work:** when a later ADR opens franchise count to configuration,
  it needs to address how derived defaults (schedule, cap, divisions) scale with
  count and where the branching lives in the generation pipeline. It is not a
  one-line change.
