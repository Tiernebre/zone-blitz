# 0032 — League home page as contextual dashboard

- **Date:** 2026-04-16
- **Status:** Accepted
- **Area:** UI — see
  [`../north-star/league-management.md`](../north-star/league-management.md);
  builds on
  [`./0014-season-calendar-phase-state-machine.md`](./0014-season-calendar-phase-state-machine.md),
  [`./0018-genesis-phase-state-machine.md`](./0018-genesis-phase-state-machine.md),
  [`./0020-phase-gated-sidebar-navigation.md`](./0020-phase-gated-sidebar-navigation.md),
  [`./0031-post-generation-land-in-first-genesis-phase.md`](./0031-post-generation-land-in-first-genesis-phase.md)

## Context

The league home page (`/league/:id`, rendered by `LeagueHome`) currently shows a
stub view whose title and description change per phase. ADR 0020 already gates
the sidebar navigation on phase, and ADR 0031 establishes that a newly created
league lands the founder directly in the dashboard at the first incomplete
genesis phase. But the home page itself has no design commitment — it doesn't
surface what's happening in the league, what the user should do next, or how the
league's story is unfolding.

A franchise sim's home page is the first thing a returning player sees when they
open their league. If it's empty, the player has to click through sidebar links
to piece together what's going on. If it's a static overview that doesn't adapt,
it becomes irrelevant within a few phases. The home page needs to serve as a
**TL;DR of the league's current state** — what just happened, what's happening
now, and what to do next — and it needs to adapt as the league progresses
through genesis, the inaugural season, and every season after.

ADR 0014's phase state machine provides the substrate: the current
`(phase,
stepIndex)` on the `league_clock` determines what the league is doing
right now. ADR 0020's phase-gating determines what nav entries are visible. This
ADR commits to the home page being **phase-aware** in the same way, surfacing
contextually relevant information and actions.

## Decision

**The league home page is a contextual dashboard that adapts its content to the
league's current phase.** It is not a static page and it is not a different page
per phase — it is a single route (`/league/:id`) whose sections are
conditionally rendered based on `league_clock.phase`.

The page is structured around three persistent sections that appear in every
phase, plus phase-specific content slots:

### 1. Phase banner

A prominent banner at the top of the page identifying:

- **Current phase name** (human-readable, e.g. "Staff Hiring", "Week 6", "Free
  Agency")
- **Season year** (e.g. "Year 1", "Year 4")
- **Brief description** of what this phase is about — one sentence orienting the
  user

This replaces the current stub title/description with a persistent, phase-driven
header.

### 2. Quick actions

A set of contextual action cards or buttons directly below the banner. These are
the one to three things the user most likely wants to do right now, given the
current phase. Quick actions link to the relevant page — they do not perform the
action inline.

#### Quick actions by phase group

**Genesis phases:**

| Phase                      | Quick actions                   |
| -------------------------- | ------------------------------- |
| `genesis_staff_hiring`     | Hire coaches, Hire scouts       |
| `genesis_founding_pool`    | View founding pool              |
| `genesis_allocation_draft` | Go to allocation draft          |
| `genesis_free_agency`      | Browse free agents, View roster |
| `genesis_kickoff`          | Advance to regular season       |

**Offseason phases:**

| Phase               | Quick actions                           |
| ------------------- | --------------------------------------- |
| `offseason_review`  | View awards, View standings             |
| `coaching_carousel` | Review coaching staff                   |
| `tag_window`        | Tag a player, View roster               |
| `restricted_fa`     | Tender restricted free agents           |
| `legal_tampering`   | View upcoming free agents               |
| `free_agency`       | Browse free agents, View salary cap     |
| `pre_draft`         | View draft board, View scouting reports |
| `draft`             | Go to draft room                        |
| `udfa`              | Sign undrafted free agents              |
| `offseason_program` | View roster, View depth chart           |

**In-season phases:**

| Phase            | Quick actions                                           |
| ---------------- | ------------------------------------------------------- |
| `preseason`      | View roster, Set depth chart                            |
| `regular_season` | View upcoming matchup, View standings, View trade block |
| `playoffs`       | View upcoming matchup, View standings                   |

**Year-end:**

| Phase                | Quick actions                             |
| -------------------- | ----------------------------------------- |
| `offseason_rollover` | View expiring contracts, View draft order |

This table is illustrative; the authoritative mapping lives in code alongside
the nav config. Quick actions should only reference pages that are visible in
the current phase per ADR 0020's gating — a quick action must never link to a
page the sidebar hides.

### 3. League snapshot

A summary section below the quick actions showing at-a-glance league state. The
content adapts by phase group:

- **During genesis:** team count, current phase progress (e.g. "5 of 8
  franchises have hired staff"), roster size
- **During offseason:** team record (prior season), cap space remaining, number
  of roster spots open, key free agents available
- **During regular season / playoffs:** team record, current standing / playoff
  seed, next opponent, points scored / allowed

The snapshot does not attempt to replicate the full detail of dedicated pages
(standings, roster, salary cap). It surfaces two to four key numbers that answer
"how is my team doing?" at a glance, with links to the full pages for detail.

### Phase-specific content slots

Below the persistent sections, the page may render additional phase-specific
content when it adds value:

- **Regular season:** recent results (last 1-3 games with W/L and score)
- **Playoffs:** bracket position or upcoming round
- **Offseason review:** award winners
- **Draft:** current draft position and round

These slots are optional and data-driven — if there is nothing meaningful to
show for a phase, the section is omitted rather than rendered empty.

## Alternatives considered

- **A different route / component per phase.** Each phase gets its own home page
  component (e.g. `GenesisStaffHiringHome`, `RegularSeasonHome`). Rejected:
  duplicates layout structure, makes cross-phase consistency hard to maintain,
  and turns "add a snapshot metric" into a multi-file change. A single component
  with conditional sections keeps the page coherent and the config centralized.

- **A static home page that doesn't change with phase.** Show the same overview
  regardless of where the league is. Rejected: during genesis most overview data
  doesn't exist yet (no standings, no record, no schedule), so the page would be
  mostly empty. During the season, genesis-specific actions are irrelevant. A
  static page either lies or is empty in every phase except one.

- **No home page — land the user on the most relevant feature page for the
  current phase.** Skip the dashboard entirely and route `/league/:id` to the
  phase's primary page (e.g. `/league/:id/roster` during free agency). Rejected:
  loses the TL;DR value of seeing league state at a glance, and creates a
  confusing UX where the "home" link goes to a different page each phase. The
  home page should orient, not replace feature pages.

- **Render quick actions inline (perform the action on the home page itself).**
  E.g. let the user sign a free agent directly from the dashboard. Rejected:
  duplicates feature-page logic, increases the home page's complexity, and
  creates two code paths for the same action. Quick actions are links, not
  embedded workflows.

- **Show all sections for all phases, with empty-state placeholders.** Display
  "No standings yet" during genesis, "No draft data" during the season, etc.
  Rejected: empty states add visual noise and train the user to ignore sections.
  Hiding irrelevant sections is cleaner and consistent with ADR 0020's approach
  of hiding nav items rather than disabling them.

## Consequences

- **Makes easier:** returning to a league. A player who hasn't opened their
  league in a week sees immediately what phase they're in, what happened, and
  what to do next — no sidebar-hunting required.
- **Makes easier:** genesis onboarding. ADR 0031 already lands the founder in
  the dashboard; this ADR ensures that landing is informative rather than a
  stub. The phase banner orients, the quick actions direct, and the snapshot
  shows progress.
- **Makes easier:** adding new phases or features. Quick actions and snapshot
  metrics are data-driven config keyed on phase — adding a new phase or a new
  metric is a localized change, not a structural one.
- **Makes harder:** the home page now has a data-fetching surface that spans
  multiple features (roster, standings, cap, schedule, draft). The API must
  expose a lightweight summary endpoint or the client must compose data from
  existing endpoints. A dedicated `/leagues/:id/dashboard-summary` endpoint is
  the likely follow-up, but the page can initially compose from existing
  endpoints.
- **Follow-up work:**
  - Replace the current `StubPage` implementation in `LeagueHome` with the
    phase-banner + quick-actions + snapshot layout
  - Define the quick-action config as a data structure alongside the phase-gated
    nav config from ADR 0020, so both stay in sync
  - Build or extend a dashboard summary API endpoint as the page's data needs
    grow beyond what existing endpoints provide
  - Wire the league snapshot section to real data as each feature (standings,
    cap, schedule) ships
