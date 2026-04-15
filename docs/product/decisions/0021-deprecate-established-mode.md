# 0021 — Deprecate established mode; genesis is the only creation flow

- **Date:** 2026-04-15
- **Status:** Accepted
- **Supersedes:**
  [0017 — League genesis as the default creation flow](./0017-league-genesis-default-creation-flow.md)
- **Area:** [League Genesis](../north-star/league-genesis.md),
  [League Management](../north-star/league-management.md)

## Context

ADR 0017 made League Genesis the canonical creation flow while keeping
"established mode" — dropping the user into a mature league with pre-generated
fictional history — available as a secondary path. That compromise has not aged
well:

- **Dual-path framing leaks everywhere.** North-star docs keep drawing contrasts
  against established mode ("in an established league, you inherit…"), which
  reframes genesis as _a_ mode rather than _the_ mode.
- **Every system inherits a shadow spec.** Trading, salary cap, drafting, and
  league management each carry "how this works in established mode" caveats that
  we never intend to build. Each caveat is a tax on both the docs and on
  decision-making.
- **ADR 0018 carries a dead-weight branch.** The `has_completed_genesis` flag
  exists solely so established-mode leagues can skip genesis. If no league is
  ever created in established mode, the flag and its handling are pure
  complexity.
- **The scrappy-upstart identity is the product.** Genesis is not the default
  choice among viable creation flows — it is the creative premise of Zone Blitz.
  Leaving an established-mode escape hatch signals that the premise is
  negotiable, which undercuts it.

ADR 0017's "established mode as secondary path" framing has never been invested
in and is not going to be. Keeping it on the books as a supported mode creates
alignment drift with no offsetting benefit.

## Decision

**Established mode is removed from the product. Every Zone Blitz league is
created through League Genesis. There is no alternate creation flow.**

Concretely:

- The north-star docs describe a single creation path: genesis. No dual-path
  framing, no "in an established league…" contrasts, no "this works the same in
  both modes" disclaimers.
- The phase state machine (ADR 0018) assumes every league begins in
  `GENESIS_CHARTER`. The `has_completed_genesis` flag on `league_clock` is still
  used to guard Year 2+ against re-entering genesis phases, but it is only ever
  set by completing genesis — never seeded by a bypass path.
- Creation UI has one entry point: "Create League" → genesis. There is no mode
  toggle, no "Start with a mature league" option, no established-mode preset.
- Follow-up systems (trading, free agency, cap, drafting, staff hiring) drop any
  established-mode caveats. Each system documents one experience: the one a
  genesis-founded league lives through.

## Alternatives considered

- **Keep ADR 0017 as-is (established mode available but not invested in).**
  Status quo. Rejected because the dual-path framing is actively harmful to doc
  and product coherence even when the second path is unbuilt. A mode that ships
  as "technically supported but not recommended" is worse than one that doesn't
  ship.
- **Ship established mode as a first-class alternative.** Rejected again, for
  the same reasons ADR 0017 rejected it: doubled design surface, fragmented
  decisions, and dilution of the scrappy-upstart identity that is Zone Blitz's
  distinctive bet.
- **Defer the decision; let the code decide.** Rejected because docs and
  decision-making are already paying the dual-path tax, and every new ADR has to
  decide whether to acknowledge established mode. Collapsing the ambiguity now
  is cheaper than collapsing it later.

## Consequences

- **Makes easier:** every downstream system documents one flow. No "how this
  works in established mode" appendices. Each north-star doc gets shorter and
  more opinionated.
- **Makes easier:** onboarding and UI. No mode toggle on Create League. No
  preset selector. The founder's first decision is "what's the league called,"
  not "which kind of league do I want."
- **Makes easier:** ADR 0018's state-machine story. `has_completed_genesis`
  becomes a simple latch set by the `GENESIS_KICKOFF → PRESEASON` transition; no
  alternate seed path to reason about.
- **Makes harder:** the 32-team-day-one use case is no longer served. A user who
  wants a mature league has to play one into existence — which is the intended
  Zone Blitz experience, but will disappoint users who come in expecting a
  classic-sim start.
- **Follow-up work:**
  - Update ADR 0017 status to Superseded with a pointer to this ADR.
  - Amend ADR 0018 to drop the "seed established-mode leagues with post-genesis
    clock state" follow-up bullet.
  - Sweep the north-star docs (`league-genesis.md`, `league-management.md`,
    `trading.md`) to remove dual-path framing and established-mode interaction
    sections.
  - When creation UI is implemented, it has one path. No mode toggle.
