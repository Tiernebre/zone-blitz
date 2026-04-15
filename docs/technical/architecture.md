# Technical Architecture Foundation

This document captures the foundational technical decisions for the football
franchise simulation. It defines the stack, system boundaries, package
structure, and design philosophy that all implementation work builds on.

---

## Stack Overview

| Layer          | Choice                              | Rationale                                                                |
| -------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| Runtime        | Deno + TypeScript                   | Native TS, built-in tooling, shared language with frontend               |
| Frontend       | Vite + React + Tailwind + shadcn/ui | SPA game UI; no SSR needed (see [UI Architecture](./ui-architecture.md)) |
| API            | Hono RPC                            | End-to-end type safety with zero codegen; built into the HTTP framework  |
| Database       | PostgreSQL                          | Relational data with complex queries (cap math, historical stats)        |
| DB access      | Drizzle ORM                         | Type-safe SQL, first-class migrations, schema-as-code                    |
| Authentication | Better Auth (Google OAuth)          | Drizzle adapter, session-based, OAuth-only                               |
| Realtime       | WebSockets                          | Live drafts, trade negotiations, multiplayer coordination                |
| Monorepo       | Deno workspace                      | Enforced dependency boundaries between layers                            |

### Why Deno

Deno runs TypeScript natively — no build step, no `ts-node`, no `tsconfig`
gymnastics for the server. Write `.ts`, run it. This eliminates an entire layer
of tooling configuration that accumulates friction over a long-lived project.

Beyond native TypeScript, Deno provides:

- **Built-in test runner.** `deno test` works out of the box with no framework
  configuration. Tests are colocated with source files.
- **Built-in formatter and linter.** `deno fmt` and `deno lint` replace Prettier
  and ESLint config files.
- **Deno workspaces.** Native monorepo support through `deno.json` workspace
  configuration, enforcing package boundaries without third-party tooling.
- **Web standard APIs.** fetch, WebSocket, streams — standards-aligned rather
  than runtime-specific.
- **Permissions model.** Explicit `--allow-net`, `--allow-env`, etc. provides a
  security baseline.

### Why TypeScript end-to-end

The simulation workload is **bursty, not sustained** — game sims run when the
season advances, not continuously. Deno handles this fine. The real payoff is a
single language across the entire stack with shared types and validation.

The compute-heavy modules (simulation engine, NPC AI) live inside the server as
pure feature slices (`server/features/simulation`, decision logic colocated with
the features that need it). They are written as pure functions behind interfaces
in `@zone-blitz/shared`, so if we outgrow Deno's performance ceiling —
realistically, when play-by-play simulation with thousands of play resolutions
per game becomes sluggish — they can be lifted out behind the same contracts.
The API layer, multiplayer coordination, and database access stay in TypeScript
where shared types and Zod schemas pay dividends.

### Why Hono RPC

Hono's built-in RPC client (`hono/client`) gives us type-safe API calls with no
code generation and no extra dependencies. Route definitions on the server are
the single source of truth — the client infers types directly from them via
`typeof app`.

Since we already use Hono as the HTTP framework, this eliminates an entire
dependency layer (tRPC server + client + adapter) while keeping the same
type-safety guarantees. It also means HTTP routes and WebSocket routes use the
same framework — critical for a game that needs both REST endpoints and realtime
connections for live drafts and trade negotiations. See
[Backend Architecture](./backend-architecture.md) for the full pattern.

### Why Drizzle ORM

Drizzle's query builder maps closely to SQL rather than hiding it behind ORM
abstractions. For the complex queries this domain requires — cap projections
with proration math, multi-year historical aggregations, conditional pick
resolution — we want to think in SQL, not fight an abstraction.

Key properties:

- **Migrations are first-class.** `drizzle-kit` generates SQL migrations from
  schema changes. The workflow is: change the schema, generate the migration,
  review the actual SQL, apply. No magic.
- **Schema-as-code.** Tables are defined in TypeScript. Types are inferred from
  the schema — no separate type definitions to maintain.
- **Two query APIs.** The relational API handles simple reads cleanly. The core
  query builder handles complex domain queries as type-safe SQL. Both are
  available; use whichever fits.

### Why Better Auth

[Better Auth](https://www.better-auth.com/) handles authentication with a
Drizzle adapter that shares the same database and schema definitions as the rest
of the application. No separate auth database, no external auth service
dependency.

Configuration:

- **OAuth-only.** Google as the social provider. No email/password — no password
  reset flows, no email verification complexity. Adding providers (Discord,
  GitHub) later is trivial with Better Auth's social provider API.
- **Drizzle adapter.** Auth tables (user, session, account, verification) are
  defined in the Drizzle schema alongside domain tables. Migrations are unified
  — one migration history for the entire database.
- **Session-based.** Better Auth manages sessions server-side with token-based
  session lookup. The session provides the authenticated user identity that API
  routes and WebSocket connections use for authorization.
- **Auth schema is auth-only.** The `user` table managed by Better Auth contains
  authentication concerns (email, OAuth accounts, sessions). Game domain
  concepts (GM profile, league membership, franchise ownership) are separate
  tables that reference the auth user by ID. NPC GMs are modeled entirely
  outside the auth schema — they are domain entities, not users.

---

## Monorepo Structure

```
packages/
  shared/         # Domain types, Zod schemas, interfaces
server/           # API, database, multiplayer coordination, simulation + AI features
client/           # React SPA
e2e/              # Playwright E2E tests
```

### Dependency rules

These are hard constraints, not guidelines. The build should fail if violated.

```
shared       → (no internal dependencies)
server       → shared
client       → shared
```

### Package responsibilities

**`shared`** — The vocabulary of the system.

- Domain entity types (Player, Team, Contract, Coach, Scout, DraftPick, etc.)
- Zod validation schemas shared between client and server
- Interface definitions that the server implements
- Enums and constants (positions, personality axes, contract types)
- No logic, no side effects, no runtime dependencies beyond Zod

**`server`** — The orchestrator and the domain engine.

- Hono API routes
- Drizzle schema definitions and database access
- WebSocket server for realtime multiplayer
- Game simulation (`server/features/simulation`): box score → drive →
  play-by-play
- NPC decision-making (GM strategies, draft boards, trade evaluation) colocated
  with the features that use them
- Season advancement orchestration
- Authentication and league/user management
- Repository implementations that fulfill shared interfaces

Simulation and AI modules inside the server are still written as pure functions
against interfaces defined in `@zone-blitz/shared` — no DB, HTTP, or I/O — so
they remain testable and extractable, they just ship inside the server package
today.

**`client`** — The frontend.

- React SPA (see [UI Architecture](./ui-architecture.md))
- Hono RPC client consuming server API
- WebSocket client for realtime events
- Imports types from `shared` only — never from `server`

---

## Interface-Driven Design

Interfaces are the primary tool for decoupling. Simulation and NPC decision
logic inside the server depend on abstractions defined in `shared`. Feature
factories provide the concrete implementations. This enables testing,
substitution, and future extraction.

### Design pattern strategy

**Strategy — NPC AI personalities**

NPC GM behavior is driven by personality axes (risk tolerance, time horizon,
positional bias, analytics trust, scheme loyalty, aggressiveness). The Strategy
pattern maps personality profiles to decision-making implementations.

```typescript
// shared/src/ai/gm-strategy.ts
interface IGMStrategy {
  evaluateTrade(context: TradeContext): TradeDecision;
  buildDraftBoard(context: DraftContext): DraftBoard;
  evaluateFreeAgent(context: FreeAgentContext): BidDecision;
  assessCoach(context: CoachContext): CoachDecision;
  assessRoster(context: RosterContext): RosterAssessment;
}
```

Individual strategy implementations (WinNowStrategy, DeveloperStrategy, etc.)
live alongside the features that consume them in the server. A GM's personality
axes determine which strategy — or weighted blend of strategies — drives their
decisions. This is not a rigid one-archetype-per-GM mapping; the axes create a
continuous space of behavior.

**Repository — Data access abstraction**

The simulation engine never touches the database. It works through repository
interfaces that the server layer implements.

```typescript
// shared/src/repositories/player-repository.ts
interface IPlayerRepository {
  findById(id: PlayerId): Promise<Player>;
  findByTeam(teamId: TeamId): Promise<Player[]>;
  save(player: Player): Promise<void>;
}
```

In production, `server` implements these with Drizzle queries against
PostgreSQL. In tests, a simple in-memory implementation fulfills the same
interface. If the simulation engine moves to Go, the interface becomes a gRPC
service contract.

**Observer / Domain Events — System coordination**

When something happens in the domain (a trade executes, a player is drafted, a
coach is fired), the system emits a domain event. Subsystems subscribe
independently.

```typescript
// shared/src/events/domain-events.ts
interface IDomainEventBus {
  publish(event: DomainEvent): void;
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: (event: T) => void,
  ): void;
}

type DomainEvent =
  | TradeExecutedEvent
  | PlayerDraftedEvent
  | CoachFiredEvent
  | SeasonAdvancedEvent
  | FreeAgentSignedEvent;
// ...
```

A single trade execution triggers:

- Media system generates headlines and trade grades
- Owner patience adjusts based on trade perception
- Multiplayer clients receive real-time notifications
- League history records the transaction
- Compensatory pick tracking updates

Each of these is an independent subscriber. No subsystem needs to know about the
others. Adding a new reaction to an event means adding a subscriber, not
modifying the trade execution code.

**Factory — Procedural generation**

Draft classes, coaches, scouts, and media personalities are procedurally
generated. Factory interfaces define the contract; implementations live inside
the relevant server features.

```typescript
// shared/src/generation/draft-class-factory.ts
interface IDraftClassFactory {
  generate(config: DraftClassConfig): DraftClass;
}

interface ICoachFactory {
  generate(config: CoachGenerationConfig): Coach;
}
```

This keeps generation logic testable (deterministic with seeded randomness) and
swappable (different generation strategies for different league configurations).

### Interface placement

All cross-cutting domain interfaces live in `shared`. This is non-negotiable —
it's what lets simulation and AI logic be extracted later without rewiring
consumers.

```
shared/src/
  interfaces/
    repositories/     # IPlayerRepository, ITeamRepository, etc.
    services/         # IGameSimulator, IDraftEngine, etc.
    events/           # IDomainEventBus
    generation/       # IDraftClassFactory, ICoachFactory, etc.
    ai/               # IGMStrategy
  types/              # Domain entity types
  schemas/            # Zod validation schemas
  constants/          # Enums, position lists, config constants
```

---

## Database Strategy

### Schema-as-code with Drizzle

Database tables are defined in TypeScript in the `server` package. Drizzle
infers TypeScript types from the schema — these are the canonical types for
database rows. Domain types in `shared` may differ from database row types (the
domain model is not the persistence model), and mapping between them happens in
the repository implementations.

```
server/src/
  db/
    schema/           # Drizzle table definitions
    migrations/       # Generated SQL migration files
    repositories/     # Repository implementations (fulfill shared interfaces)
```

### Migration workflow

1. Modify the Drizzle schema file
2. Run `drizzle-kit generate` to produce a SQL migration
3. Review the generated SQL — it's human-readable and checked into source
   control
4. Apply with `drizzle-kit migrate`

Migrations are sequential, versioned, and reviewable. The migration history is
the authoritative record of how the database evolved.

### Domain types vs. database types

The domain model in `shared` represents the game's concepts as the simulation
understands them. The database schema represents how those concepts are stored.
These are not always the same:

- A `Player` domain type might flatten attributes from multiple database tables
  (player, attributes, contract, injury history)
- A `Contract` domain type might compute derived values (current cap hit, dead
  cap if cut) that aren't stored columns
- The simulation engine works with domain types — it never sees a database row

Repository implementations in `server` handle the mapping. This keeps the domain
model clean and the persistence model optimizable independently.

---

## Realtime Architecture

### WebSocket connection model

Each multiplayer league maintains a WebSocket connection per connected client.
The server manages league-scoped rooms — events in one league are never
broadcast to another.

```
Client A (Eagles GM) ──WebSocket──┐
Client B (Cowboys GM) ──WebSocket──├── League Room "league-123"
Client C (Giants GM) ──WebSocket──┘
```

### Event flow

Realtime events flow through the domain event bus. The WebSocket layer is a
subscriber — it listens for domain events and forwards relevant ones to
connected clients in the appropriate league room.

```
Trade executes
  → DomainEventBus.publish(TradeExecutedEvent)
    → MediaSubscriber: generates headlines
    → OwnerSubscriber: adjusts patience
    → WebSocketSubscriber: broadcasts to league room
      → Client A receives: "Eagles acquire CB from Cowboys for 2nd round pick"
      → Client B receives: "Cowboys trade CB to Eagles for 2nd round pick"
      → Client C receives: "Trade alert: Eagles acquire CB from Cowboys"
```

### Key realtime scenarios

**Live draft:**

- Server manages pick timer and turn order
- On-the-clock events, pick announcements, and trade offers are pushed to all
  clients
- If a client disconnects, auto-draft from their pre-set board kicks in

**Trade negotiations:**

- A negotiation is a private channel between two clients (or a client and the
  NPC AI)
- Asset changes and messages are pushed in real time
- Proposals and counter-proposals are events on the channel
- Other league members see the completed trade, not the negotiation

**Season advancement:**

- Commissioner or ready-check triggers advancement
- Server runs simulation (via `server/features/simulation`)
- Results are pushed to all clients as they're produced
- Clients can watch game results, transaction activity, and news unfold

---

## Future Extraction Path

The simulation and AI modules inside the server are written as pure functions
behind `@zone-blitz/shared` interfaces so that, if needed, they can be lifted
out into standalone services without rewriting the rest of the system.

### What extraction looks like

**Today (TypeScript monorepo):**

```
server → imports sim module → calls simulate(gameState)
server → imports AI module → calls evaluateTrade(context)
```

Direct function calls. Fast, simple, no serialization overhead.

**Future (extracted service):**

```
server → gRPC/HTTP call → Go simulation service → returns GameResult
server → gRPC/HTTP call → Go AI service → returns TradeDecision
```

The server's code changes from a function call to a service call. The interfaces
in `shared` become the gRPC/HTTP contract. The domain types become the message
schema.

### What makes this possible

1. **No I/O in simulation or AI modules.** They don't touch databases, file
   systems, or networks. Pure in, pure out. A Go rewrite implements the same
   logic without untangling I/O dependencies.

2. **Interfaces defined in shared.** The contracts are already explicit. They
   translate directly to service API definitions.

3. **Domain types are serializable.** Every type flowing across the boundary is
   a plain data structure — no class instances, no circular references, no
   database connection objects. They serialize to JSON or Protobuf trivially.

4. **The server features are the only orchestrators.** They decide when to call
   the sim engine, what state to pass, and what to do with the results.
   Extraction changes _how_ they call, not _what_ they call or _when_.

### When to extract

Not yet. Extract when:

- Play-by-play simulation becomes a bottleneck (thousands of play resolutions
  per game × 272 games per season advance)
- NPC AI decision-making for 31 teams during time-sensitive events (draft picks
  with timers) needs lower latency than Deno provides
- Profiling confirms the bottleneck is CPU-bound computation, not I/O or
  database queries

Until then, the single-language monorepo is a productivity advantage we
shouldn't give up prematurely.

---

## Testing Strategy

Testing is split into three layers, each with its own tooling and purpose.

### Server tests — Deno's native test runner

Server-side code uses `deno test` directly. No framework to configure, no test
runner to install.

```
deno test server/ --allow-env --allow-net --allow-read --allow-sys
```

Server tests cover:

- Domain logic (simulation, AI decisions, cap math)
- Repository implementations against a real PostgreSQL database
- API route behavior
- Auth configuration

Tests that touch the database run against a dedicated test database. No mocking
the database in integration tests — the test hits real PostgreSQL so migration
and query correctness are verified end-to-end.

### Client tests — Vitest + Testing Library

The React SPA uses Vitest (integrated with Vite) and Testing Library:

- **Vitest** runs in the happy-dom environment for fast DOM simulation
- **Testing Library** provides user-centric queries (`getByRole`, `getByText`)
  that test behavior, not implementation
- **Test setup** polyfills browser APIs (WebSocket, matchMedia) that happy-dom
  doesn't provide

```
cd ui && deno run -A npm:vitest run
```

Client tests cover:

- Component rendering and interaction
- Hook behavior
- Form validation flows
- Event handling (draft events, trade notifications)

### E2E tests — Playwright

End-to-end tests run a real server against a real database with a real browser.
Playwright drives Chromium through full user journeys.

**Infrastructure:**

- A dedicated E2E database is created and migrated before the test suite runs
- The E2E setup script creates the database if missing and runs Drizzle
  migrations
- Docker Compose provides the local PostgreSQL instance (shared with
  development, separate database name for E2E)

**Authentication in E2E:**

E2E tests bypass the OAuth flow by injecting session cookies directly into the
browser context. A test fixture:

1. Seeds a test user with a pre-signed session token into the database
2. Signs the session token using HMAC-SHA256 with the `BETTER_AUTH_SECRET`
3. Sets the session cookie on the Playwright browser context

This gives each test an authenticated user without touching Google OAuth.
Multiple test users (authenticated page 1, authenticated page 2) support
multiplayer interaction tests.

**Database isolation:**

Each test starts with a clean database. A `resetDatabase()` helper truncates all
tables in dependency order before each authenticated test. Seed helpers create
deterministic test data (leagues, drafts, rosters) for specific scenarios.

**Test structure:**

```
e2e/
  fixtures/
    auth.ts           # Authenticated page fixtures
  helpers/
    db.ts             # Database reset and connection
    seed-data.ts      # Test user and session data
    seed-league.ts    # League/roster seeding for specific scenarios
  tests/
    smoke.spec.ts     # Health check, auth redirects, basic rendering
    league.spec.ts    # League creation, management
    draft.spec.ts     # Draft room interactions
  setup.ts            # Database creation and migration
  playwright.config.ts
```

**Playwright configuration:**

- Fully parallel execution locally, single worker in CI for stability
- 2 retries in CI, 0 locally
- Auto-starts the server (builds client, starts server in production mode)
- Captures traces on first retry for debugging failures
- HTML report generated on failure

### CI pipeline

CI runs as a GitHub Actions workflow:

1. **Lint** — `deno lint`
2. **Format** — `deno fmt --check`
3. **Migration journal** — validates migration file ordering
4. **Test** — server + client tests against a PostgreSQL service container
5. **E2E** — Playwright tests against a full server + database (depends on test
   job passing first)
6. **Docker smoke** — builds the Docker image, starts it, polls the health
   endpoint

E2E failures upload the Playwright report as a CI artifact for debugging.

### Test execution scripts

```
bin/test       # Runs server + client tests
bin/test-e2e   # Creates E2E database, runs migrations, runs Playwright
```

Deno tasks in `deno.json` provide the canonical test commands:

```json
{
  "tasks": {
    "test": "deno task test:server && deno task test:client",
    "test:server": "deno test server/ --allow-env --allow-net --allow-read --allow-sys",
    "test:client": "cd ui && deno run -A npm:vitest run",
    "test:e2e": "./bin/test-e2e"
  }
}
```

---

## Deployment

### Model

Single DigitalOcean Droplet running Docker Compose. The application is a single
container (Deno server serving the built React SPA) alongside a PostgreSQL
container. Simple, cheap, sufficient for early multiplayer leagues.

### Docker image

The Dockerfile uses a multi-stage build:

1. **Base stage** — `denoland/deno` image, installs dependencies from workspace
   config files (cached layer)
2. **Build stage** — copies source, builds the React client with Vite
3. **Production stage** — copies source + built client assets, runs migrations
   on startup, then starts the server

```dockerfile
# Migrations run automatically on container start
CMD ["sh", "-c", "cd server && deno run ... db/migrate.ts && deno run ... main.ts"]
```

The image is tagged with `GIT_SHA` as a build arg so the running container can
report which commit it's on via the health endpoint. This enables deployment
verification.

### Compose files

**`docker-compose.yml`** — local development:

- PostgreSQL 17 with health check
- Init script creates the E2E test database alongside the dev database
- No application container — the server runs directly via `deno task dev`

**`docker-compose.prod.yml`** — production on the Droplet:

- Application container from GHCR, port 80 → 3000
- PostgreSQL 17 with persistent named volume
- `depends_on` with health check condition ensures the database is ready before
  the app starts
- `restart: unless-stopped` for both services
- Environment variables via `.env` file on the Droplet

### CI/CD pipeline

Deployment is a GitHub Actions workflow triggered on push to `main`:

1. **CI must pass first** — lint, format, tests, E2E, Docker smoke
2. **Build and push** — Docker image built with `GIT_SHA` arg, pushed to GHCR
3. **SCP compose file** — `docker-compose.prod.yml` copied to the Droplet
4. **Deploy via SSH** — pull image, `docker compose up -d`
5. **Verification** — confirm the running container is on the expected image
   digest (not a stale container from a failed pull)
6. **Smoke test** — poll the health endpoint and assert the `commit` field
   matches the deployed SHA
7. **Cleanup** — prune images older than 24 hours (keep recent for rollback)

### Safety checks

- **Disk pressure check** before `docker pull` — abort if root filesystem
  exceeds 85% to prevent failed pulls from leaving orphaned layers
- **Image digest verification** after `docker compose up` — confirm the running
  container matches the image we just pushed, catching silent no-op recreates
- **Commit SHA smoke test** — the health endpoint returns the baked-in
  `GIT_SHA`, and the deploy workflow asserts it matches. A stale container
  returning 200 on a different commit fails the deploy.

### Health endpoint

The server exposes `/api/health` which returns:

```json
{
  "status": "ok",
  "commit": "abc123..."
}
```

Used by the deploy workflow's smoke test and by the Docker smoke CI job. The
commit field is the `GIT_SHA` build arg baked into the image at build time.
