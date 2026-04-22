# Zone Blitz

Browser-based single-player GM/Owner simulator for a fictional spring football league (UFL/XFL-style, 8 teams, 10-game season). The player hires coaches and scouts, manages a staff cap, and watches a play-level game engine calibrated to real NFL distributions produce the season. Football is the theme; the hiring market and per-play economy are the mechanics. See [docs/product/north-star/charter.md](docs/product/north-star/charter.md) for the product charter.

## Tech stack

Java 25 on Spring Boot 4 with Gradle (Kotlin DSL); Postgres 17 via jOOQ 3.19 (typed DSL, code-generated from the live schema) and Flyway migrations; Thymeleaf + HTMX + Tailwind for the web layer (vanilla JS only where HTMX can't reach); JUnit 5 + AssertJ + Testcontainers for tests and Playwright for a small E2E suite; Spotless with google-java-format 1.28.0; JaCoCo for coverage; Spring Security with Google OAuth2 for auth. The game-simulation engine lives in a separate Gradle source set (`src/gamesimulator/`) and is bundled into the same boot JAR. Full tech summary in [docs/tech-stack.md](docs/tech-stack.md).

## Quick start

1. `docker compose up -d postgres` — starts the single Postgres 17 service from [compose.yaml](compose.yaml).
2. `./gradlew bootRun` — builds Tailwind, runs Flyway, regenerates jOOQ sources, starts the app on [http://localhost:3000](http://localhost:3000). Or run [`./dev`](dev), which wraps `bootRun` with Tailwind watch, continuous compile, and prefixed log streams.
3. `./gradlew test` — full test suite (excludes the `e2e` Playwright tag). Use `./gradlew e2eTest` for the Playwright slice. `./gradlew spotlessApply` formats Java before commit.
4. `./emulate [snaps] [seed]` — runs the game-simulator REPL (wraps `./gradlew emulate -Pargs=…`) for seeded play-level debugging without starting the web app.

OAuth login requires `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`; a local `.env` file is picked up by `bootRun` automatically.

## Where things live

Top-level Java packages under `src/main/java/app/zoneblitz/`:

| Package | Purpose |
|---|---|
| `league` | League lifecycle use cases (create, delete, advance day) and the `League` aggregate root. |
| `league/hiring` | Candidate pool, preferences, offers, counter-offers, and the hire transaction for coaches and scouts. |
| `league/phase` | League phase state machine (`INITIAL_SETUP` → `HIRING_HEAD_COACH` → ... → `ASSEMBLING_STAFF`) and per-phase transition handlers. |
| `league/staff` | Post-hire franchise staff: coaching org chart, scouting org chart, staff recap views. |
| `league/team` | Team aggregate, CPU team strategy, per-team hiring state and city profile. |
| `league/cap` | Staff salary cap breakdown and the cap-status view. |
| `league/franchise` | Franchise aggregate — the user's binding to a team inside a league. |
| `league/geography` | US region / market-size / climate enums used by candidate preference scoring. |
| `names` | Seeded name generation for players, coaches, scouts. |
| `web` | Top-level web controllers that aren't owned by a feature (health, landing). |
| `config` | Spring configuration (security, session). |

The game engine lives in a parallel source set:

| Source set | Purpose |
|---|---|
| `src/gamesimulator/` | Play-level simulation — per-snap pipeline, play caller, resolver, penalty/injury/fatigue/clock models, band sampler, seeded RNG. Imports **zero** types from `app.zoneblitz.league`; the dependency is strictly `league → gamesimulator`. |

## Conventions

See [CLAUDE.md](CLAUDE.md) for the full conventions. Highlights: records over classes for data, `Optional<T>` for absence, sealed `Result` unions for expected domain outcomes, interface-test-driven development (code against interfaces, concrete types only at wiring), feature-per-package with package-private internals, Testcontainers (never mocks, never H2) for anything that touches the database, constructor injection only, `./gradlew spotlessApply` before commit, and a ≤500 LOC hard ceiling per file.

## Docs map

- [docs/tech-stack.md](docs/tech-stack.md) — runtime, data, frontend, deployment, testing, auth.
- [docs/technical/sim-engine.md](docs/technical/sim-engine.md) — per-snap pipeline, matchup math, band sampling, `PlayEvent` stream, calibration harness.
- [docs/technical/league-phases.md](docs/technical/league-phases.md) — phase state machine, hiring sub-state, candidate preferences schema.
- [docs/technical/staff-market-implementation.md](docs/technical/staff-market-implementation.md) — blueprint for the staff cap + counter-offer system inside `league/hiring`.
- [docs/technical/agent-friendliness-audit.md](docs/technical/agent-friendliness-audit.md) — point-in-time audit of how agent-friendly the repo is, with the optimization plan.
- [docs/product/north-star/](docs/product/north-star/) — charter and supporting design pillars (archetypes, schemes, busts-and-gems, scarcity economy).
- [docs/product/proposals/staff-market-counter-offers.md](docs/product/proposals/staff-market-counter-offers.md) — current proposal driving hiring-market work.
- [data/docs/](data/docs/) — narrative companions to `data/bands/`; explains the real-NFL distributions the sim calibrates against.

## For agents working in this repo

The repo prioritizes being easy for coding agents to work in. Per-feature `README.md` files explain each feature's public surface and extension seams; `docs/playbooks/` shows how to add common things (new use case, new phase, new Result variant, new sim seam); ArchUnit tests in `src/test/java/app/zoneblitz/architecture/` encode the non-negotiable rules (no internal cross-feature imports, no jOOQ types crossing the data-layer boundary, no unseeded RNG, file size ceilings). [CLAUDE.md](CLAUDE.md) has the full conventions — read it before writing code.
