# 0017 — Phase-gated sidebar navigation

- **Date:** 2026-04-15
- **Status:** Proposed
- **Area:** UI — see
  [`../north-star/league-genesis.md`](../north-star/league-genesis.md) and
  [`../north-star/league-management.md`](../north-star/league-management.md);
  builds on
  [`./0014-season-calendar-phase-state-machine.md`](./0014-season-calendar-phase-state-machine.md).

## Context

The league sidebar (`client/src/features/league/layout.tsx`) currently renders a
static set of navigation groups — Team, Team Building, League — regardless of
what phase the league is in. Every link (Roster, Coaches, Scouts, Draft, Trades,
Free Agency, Salary Cap, Standings, Schedule, Opponents, Media, Owner) is always
visible.

That model breaks down hard once
[league genesis](../north-star/league-genesis.md) ships. In Phase 1 (charter)
there are no teams yet, let alone a roster. In Phase 3 (staff hiring) there is
no draft pool, no schedule, no standings, no trades, no free agency, no cap —
but the sidebar would still invite the user into all of those dead rooms. The
inverse also holds in a mature league: there is no "genesis charter" page to
visit once Year 1 has kicked off. A sidebar that lies about what the league can
do right now is worse than one with fewer entries; it teaches users that most
links lead nowhere and trains them to ignore navigation.

With the phase state machine from ADR 0014 already landed, we have the substrate
to drive navigation off phase. We need to commit to doing so before genesis
ships, because genesis introduces _several_ phases where the sidebar must look
fundamentally different from the established-league shape.

## Decision

Gate every sidebar nav item on the league's current `phase` (from
`league_clock`). Each nav item declares the set of phases in which it is
**available**; items outside that set are hidden (not disabled, not greyed).
Phase-specific genesis-only entries (e.g. Founding Pool, Allocation Draft, Staff
Hiring) are modeled as the same kind of declarative entry and appear only during
their phase.

Concretely:

1. **Nav items gain a `visibleInPhases` predicate.** The existing `NavItem` type
   in `client/src/features/league/layout.tsx` becomes
   `{ label, path, Icon, visibleInPhases: (phase) => boolean }`. Items that are
   always-on (Home, Settings, All Leagues, Profile) return `true`
   unconditionally.
2. **Phase comes from the league clock.** The layout already fetches the league
   via `useLeague`; extend that (or add a sibling `useLeagueClock` hook) to read
   `phase` from `league_clock`. Genesis phases are represented as additional
   values in the `LEAGUE_PHASE` enum from ADR 0014 (e.g. `genesisCharter`,
   `genesisEstablishment`, `genesisStaffHiring`, `genesisPool`,
   `genesisAllocationDraft`, `genesisFreeAgency`).
3. **Groups collapse when empty.** A `NavGroup` renders only if at least one of
   its items is visible in the current phase. "Team Building" in Phase 1 has no
   visible children, so the whole group — label included — disappears.
4. **Gating is data, not branching.** No `if (phase === ...)` sprinkled through
   the layout; the phase→visibility mapping lives next to the nav config so
   adding a new phase or a new page is a single-line change.
5. **Server authority.** The server's permission checks on each feature route
   already (or will) reject requests made outside the appropriate phase. The
   sidebar is a UX affordance, not a security boundary — hiding a link does not
   replace server-side gating.

### Illustrative mapping (v1)

| Nav item         | Visible in                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| Home             | all phases                                                                                                     |
| Roster           | from `genesisAllocationDraft` onward                                                                           |
| Coaches / Scouts | from `genesisStaffHiring` onward                                                                               |
| Draft            | `genesisAllocationDraft`, `preDraft`, `draft`, `udfa`                                                          |
| Trades           | from `preseason` onward (no trades in genesis)                                                                 |
| Free Agency      | `genesisFreeAgency`, `legalTampering`, `freeAgency`, `udfa`, and during `regularSeason` for in-season signings |
| Salary Cap       | from `genesisAllocationDraft` onward                                                                           |
| Standings        | from `regularSeason` onward (no standings before Year 1 Week 1)                                                |
| Schedule         | from `preseason` onward (Year 1 has no preseason, so effectively `regularSeason` onward in Year 1)             |
| Opponents        | from `preseason` onward                                                                                        |
| Media            | from `genesisEstablishment` onward (media narrates the founding)                                               |
| Owner            | all phases (ownership votes begin in genesis)                                                                  |
| Founding Pool    | `genesisPool` only                                                                                             |
| Allocation Draft | `genesisAllocationDraft` only                                                                                  |
| Staff Hiring     | `genesisStaffHiring` only                                                                                      |
| Charter          | `genesisCharter` only                                                                                          |
| Settings         | all phases                                                                                                     |

This table is illustrative; the authoritative mapping lives in code with the nav
config.

## Alternatives considered

- **Disable (grey out) links instead of hiding them.** Rejected: in genesis this
  leaves the sidebar 80% disabled, which is visual noise and pushes players to
  hover-inspect tooltips to find the one live link. Hiding mirrors how the game
  treats these features internally — they do not yet exist in this league.
- **One sidebar component per phase.** Rejected: duplicates layout, drifts, and
  makes "add Scouts to the sidebar" an N-phase change. Declarative gating keeps
  the layout single-sourced.
- **Server-rendered nav payload.** Rejected for v1: the nav is a client concern
  today and there is no existing nav endpoint. A `/leagues/:id/nav` API is worth
  revisiting when gating rules get more complex (role-based,
  feature-flag-based), but phase alone does not justify a new endpoint.
- **Route-level guards only (let routes 404 out of phase).** Rejected: keeps the
  sidebar lying. Guards are still needed server-side, but the sidebar should not
  offer a door that leads to a 404.
- **Gate on entities-exist heuristics (show Roster if roster is non-empty, etc.)
  instead of phase.** Rejected: couples UI to incidental state and makes "why
  did Roster appear?" a question about data rather than about where the league
  is in its lifecycle. Phase is the canonical truth.

## Consequences

- **Genesis UX becomes buildable.** Genesis phases can each ship their
  phase-only pages (Charter, Staff Hiring, Allocation Draft, Founding Pool)
  without contorting the established-league sidebar.
- **The sidebar stops lying.** Every visible link leads to a page that is
  meaningful in the current phase. Users learn to trust it.
- **One place to update.** Adding a new page, a new phase, or changing when a
  page becomes available is a single-line edit to the nav config.
- **Phase enum grows.** ADR 0014's `LEAGUE_PHASE` enum gains the genesis phases
  (`genesisCharter`, `genesisEstablishment`, `genesisStaffHiring`,
  `genesisPool`, `genesisAllocationDraft`, `genesisFreeAgency`). The enum
  remains the single source of truth for "where is this league?".
- **Tests must cover the mapping.** Component tests should assert, for a
  representative set of phases, which nav items render — otherwise a regression
  hides features the user needs mid-season.
- **Follow-ups not in this ADR:**
  - The genesis phase enum additions themselves (an ADR or an extension to 0014)
    and their gate/effect functions.
  - Per-phase landing views (what does `Home` look like during
    `genesisCharter`?), which ADR 0014 already flagged as a UI follow-up.
  - Role-based gating (commissioner-only pages, owner-only pages) layered on top
    of phase gating.
  - A "what's next?" affordance on Home that points at the phase-appropriate
    action, so the sidebar shrinking doesn't hide forward momentum.
