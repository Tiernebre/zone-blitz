# 0022 — Per-league unique coach and scout generation

- **Date:** 2026-04-15
- **Status:** Accepted
- **Area:** [League Genesis](../north-star/league-genesis.md),
  [Coaches](../north-star/coaches.md), [Scouting](../north-star/scouting.md)

## Context

Zone Blitz generates a brand-new professional football league from scratch every
time a user clicks "Create League." The north-star docs for League Genesis,
Coaches, and Scouting all assert the same rule: every coach and scout in a
league is generated uniquely for that league, with no shared pool across save
files and no recurring identities between leagues. This constraint has real
implementation cost — generation time scales with roster size, database storage
grows per league, and cross-league identity continuity is impossible — so it
warrants formal ratification as a deliberate design decision rather than an
incidental implementation detail.

## Decision

Coach and scout identities are generated per league at creation time and never
shared across save files. When a league is created, its entire coaching and
scouting universe — names, tendency profiles, scheme preferences, career
backgrounds, personalities — is generated from scratch. No coach or scout
identity is reused, recycled, or drawn from a global pool. Each league's staff
universe is fully self-contained.

## Alternatives considered

- **Shared global pool with per-league state** — maintain a single master roster
  of coach and scout identities and assign a subset to each league at creation.
  Rejected because it undermines the core promise of genesis: that every save
  file is a unique origin story. Recognizing the same "Coach Williams" across
  three different saves breaks immersion and makes the coaching universe feel
  templated rather than generated. It also creates a coupling between save files
  that complicates deletion, export, and multiplayer isolation.

- **Hybrid model (some "legendary" names recur, most generated)** — seed each
  league with a small set of fixed, recognizable coaching archetypes while
  generating the rest uniquely. Rejected because any recurring identity, no
  matter how small the set, creates the impression that the league world is
  pre-authored rather than emergent. It also introduces a two-tier system where
  "legendary" coaches feel qualitatively different from generated ones, which
  undermines the design goal that every coach is a one-of-one whose career arc
  plays out only in this league.

## Consequences

- **Generation happens at league-creation time and is potentially heavy.** The
  full coaching and scouting candidate pool must be generated before Phase 3
  (Staff Hiring) can begin. For large leagues this may be a visible wait;
  implementation should consider streaming or background generation to keep the
  genesis flow responsive.

- **No "follow a coach's career across leagues" metagame.** Players cannot track
  a favorite coach across save files. Each league's coaching tree is its own
  closed system. This is an accepted tradeoff — the uniqueness of each save
  file's history is more valuable than cross-save continuity.

- **Every save file's coaching tree is self-contained.** Coaching trees, mentor
  relationships, and career arcs are all scoped to a single league. This
  simplifies data modeling (no cross-league foreign keys) and ensures that
  deleting a save file has no side effects on any other save.

- **Database storage scales per league.** Each league stores its own full set of
  coach and scout records. No deduplication is possible across leagues. This is
  acceptable given that coach/scout records are small relative to play-by-play
  and player history data.

- **Duplicate names are acceptable.** The generator makes no effort to avoid
  name collisions, either within a league or across leagues. Two coaches in the
  same league sharing a first/last name is fine — real coaching staffs have this
  happen too, and the added implementation complexity of dedup isn't worth it.
  Identity is established by the coach record itself, not the name.
