# Zone Blitz — Charter

Source of truth for what Zone Blitz is. Shared context across sessions. Update as decisions land. Deeper topics live in sibling docs under `docs/product/north-star/` and are linked where relevant.

## TL;DR

An economy simulator with fictional football players as the asset class. Football is the theme; the market is the mechanic. Every design decision should be read through that lens.

## What it is

A browser-based single-player GM/Owner simulator for a fictional spring football league (XFL / UFL / AAFL style). State persists in the app's database across sessions. "Save" is informal shorthand for the user's persistent league state.

The sim engine is held to real-NFL statistical distributions. The nflverse data reduced under [`data/`](../../../data/) — `nflreadr` / `nflfastR` (play-by-play, rosters, snap counts, injuries, contracts, draft picks) and `bigdatabowl` (player tracking) — is the ground truth for both on-field play and front-office mechanics. Sim outputs outside the bands in `data/bands/` are bugs.

## League fiction

- United States, real US cities, no official branding (no NFL / XFL / UFL marks).
- Team names, colors, and identities are generated per league (user-editable TBD).

## League structure

- 8 teams.
- 10-game asymmetric regular season (each opponent ~1.25x on average). Matches UFL 2024 / XFL 2020.
- 4-team playoff: semifinals + championship.
- ~12 weeks of football per season.
- Roster sizes follow NFL conventions, driven by `data/bands/position-market.json`.
- Cap mechanics follow NFL conventions (proration, guarantees, void years), driven by `data/bands/free-agent-market.json` and `data/bands/contract-structure.json`. Cap *number* is fictional; structure is NFL.

## Sim engine fidelity

Play-level under the hood. User picks presentation per game:

- **Quick sim** — jump to final box score.
- **Play-by-play** — render each play.

Both modes consume the same generated play stream. Outcomes are identical; switching mid-game is allowed.

## Player role

Hybrid GM + Owner of one franchise. Covers roster construction (draft, FA, cuts, contracts), coaching staff decisions (hire, fire, evaluate), and franchise-level direction. User does not call plays, set gameplans, or make in-game football-strategy decisions — those belong to coaches.

## Core loop — Year 1

1. User creates a new league (names it, picks settings) and chooses a franchise. League + franchises are written to the DB; user is bound to the chosen franchise.
2. User hires two direct reports: **Head Coach** and **Director of Scouting**. Each then runs their own hiring search. For subordinate roles, the HC / DoS returns a shortlist; the user picks from it. Shortlist quality scales with HC / DoS quality.
3. Inaugural league draft. All franchises stock from one generated prospect pool.
4. Regular season — week-by-week sim. Coaching staff sets gameplans and play-calls. User handles roster management (injuries, waivers, depth chart).
5. Playoffs → Championship.
6. **Coach firings / hirings** — before offseason FA/draft. New HC / DoS must be in place to run their own staffing searches.
7. Offseason — free agency, rookie draft, contracts.
8. Repeat. History accumulates in the DB.

## Design pillars

1. **GM/Owner seat, not coach seat.** User hires the people who make football decisions; user does not make football decisions. No gameplan sliders, no play-calling, no in-game adjustments.
2. **Competitive parity by design.** Teams start with equal structural resources. Differentiation comes from hiring quality and GM judgment.
3. **Realistic front-office mechanics.** Scout capacity, travel budget, interview slots. No abstract points/energy economies.
4. **Hidden information.** True ratings for prospects, coaches, and scouts are hidden. User works from a noisy scouted signal. Ratings center on 50.
5. **Emergent league history.** No canonical rosters or pre-written lore.
6. **Real-NFL statistical fidelity.** Sim outputs are validated against `data/bands/`.

## Key concepts (linked docs)

- [`player-attributes.md`](./player-attributes.md) — rating philosophy. 0–100 absolute scale, centered on 50. No overall rating. Position-specific attribute sets. Distribution shapes per position.
- [`archetypes.md`](./archetypes.md) — categorical tags for players, coaches, and scouts. Orthogonal to quality. Drive scheme fit, market pricing, and attribute generation.
- [`coach-schemes.md`](./coach-schemes.md) — schemes (categorical), tendencies (continuous), developmental attributes. Scheme fit is coach-conditional roster value.
- [`scarcity-economy.md`](./scarcity-economy.md) — population sizes, bimodal shapes, draft hit rates, aging, cap mechanics. How `data/bands/` drives the player market.
- [`busts-and-gems.md`](./busts-and-gems.md) — true-vs-scouted noise model across all three hidden-rating populations.

## Prospect generation

All prospects are synthetic. Generated per league off the distributions in `data/bands/` (`draft-position-distribution.json`, `draft-hit-rates.json`, `position-market.json`, `career-length.json`). Fake names, fake schools, fake measurables drawn from real NFL distributions. No real player maps to a generated prospect.

## In scope for v1

- Multiple leagues per user (isolated DB state each). One franchise per league.
- Coaching staff hiring with hidden attributes and interview scouting.
- Inaugural draft plus annual rookie draft.
- Regular season + playoffs sim, play-level, with quick-sim and play-by-play modes.
- Free agency, cuts, contracts.
- Coach firings/hirings across seasons.

## Out of scope for v1

- Multiplayer / online leagues.
- On-field play-calling or any football-strategy input from the user (permanent, not just v1).
- Stadium / business ownership.
- Expansion, relocation, rule-change voting.
- Mobile app.

## Open questions

Unresolved decisions that shape future work. Resolve inline as they're settled.

*(none currently open)*

## Glossary

- *League* — one instance of the fictional league, created and named by a user; state lives in the DB.
- *Franchise* — one team inside a league; user controls one.
- *Season* — one league year: preseason → regular → playoffs → offseason.
