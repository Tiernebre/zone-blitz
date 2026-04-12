# Backend Architecture

This document defines the conventions, patterns, and structure for the server
package and its relationship to the pure domain packages (`simulation`, `ai`).
It is prescriptive — follow these patterns for all new backend work.

For the overall stack choices and monorepo structure, see
[architecture.md](./architecture.md).

---

## Guiding Principles

1. **Interface-driven design.** Every service and repository is coded against a
   typed interface defined in `@zone-blitz/shared`. Implementations fulfill
   those interfaces — nothing depends on a concrete type.
2. **Dependency injection.** Components receive their dependencies explicitly
   through factory function parameters. No hidden singletons, no import-time
   coupling.
3. **Vertical feature slices.** Code is organized by domain concept, not by
   technical layer. Everything about "drafting" lives in one folder.
4. **Pure domain logic is extracted.** Stateless computation lives in named
   domain logic files outside the DI graph. Services orchestrate — they don't
   compute.
5. **Composition root.** All wiring happens in one place. The rest of the
   codebase is unaware of how dependencies are assembled.

---

## Feature Structure

Each domain concept is a **feature** — a self-contained folder under
`server/features/` with a consistent internal structure.

```
server/
  features/
    mod.ts                        # Feature routers factory — creates all repos, services, routers
    league/
      mod.ts                      # Public API — exports factories
      league.router.ts            # Hono routes: validate input, delegate to service
      league.service.ts           # Orchestration + domain rule enforcement
      league.service.test.ts
      league.repository.ts        # Data access: Drizzle queries
      league.repository.test.ts
      league.schema.ts            # Drizzle table definitions
    draft/
      mod.ts
      draft.router.ts
      draft.service.ts
      draft.service.test.ts
      draft.repository.ts
      draft.repository.test.ts
      draft.schema.ts
      snake-order.ts              # Pure domain logic: pick order calculation
      snake-order.test.ts
      draft-eligibility.ts        # Pure domain logic: eligibility rules
      draft-eligibility.test.ts
      auto-pick.ts                # Pure domain logic: auto-draft selection
      auto-pick.test.ts
    trade/
      ...
    roster/
    free-agency/
    salary-cap/
    scouting/
    coaching/
    season/
  middleware/
    auth.ts                       # Authentication middleware — resolves session, narrows context
    request-context.ts            # Per-request child logger + requestId
    logger.ts                     # HTTP lifecycle logging
  db/
    connection.ts                 # Drizzle client
    migrate.ts                    # Migration runner
    schema.ts                     # Re-exports all feature schemas
    migrations/                   # Generated SQL files
  logger.ts                       # Root Pino logger
  env.ts                          # AppEnv type (Hono context variables)
  main.ts                         # Hono app — mounts middleware, auth, and feature routes
```

---

## File Conventions

Every feature follows the same naming conventions. You see the suffix, you know
what the file does.

### Files in the DI graph

These are components wired together through the composition root. They receive
dependencies via factory function parameters.

| Suffix             | Role                                                      |
| ------------------ | --------------------------------------------------------- |
| `.router.ts`       | Hono route group — validates input (Zod), delegates to services, returns responses. No business logic. |
| `.service.ts`      | Business logic — domain rule enforcement, orchestration across repositories and other services. No direct DB access. |
| `.repository.ts`   | Data access — Drizzle queries. Returns domain-shaped data. No business logic. |

### Declarative files

| Suffix             | Role                                                      |
| ------------------ | --------------------------------------------------------- |
| `.schema.ts`       | Drizzle table definitions for this feature's tables.      |
| `mod.ts`           | Barrel file — the feature's public API. Only file imported by the composition root. |

### Pure domain logic files

These sit **outside** the DI graph. They have no dependencies — no db client, no
logger, no injected services. They are pure functions: data in, data out. Name
them after the domain concept they encode, not "utils."

```
snake-order.ts          # Calculates snake draft pick order
draft-eligibility.ts    # Determines if a player can be drafted
cap-proration.ts        # Prorates salary cap charges across years
trade-value-chart.ts    # Assigns relative value to draft picks
```

The dividing line: **if it participates in DI, it's a router/service/repository.
If it's pure computation, it's a named domain logic file.**

### Tests

| Suffix             | Role                                                      |
| ------------------ | --------------------------------------------------------- |
| `.test.ts`         | Colocated test file. Named after the file under test (`draft.service.test.ts` tests `draft.service.ts`). |

---

## Typed Interfaces

All interfaces live in `@zone-blitz/shared`. This is the contract layer — every
service and repository in the server implements an interface defined here.

```
packages/shared/
  interfaces/
    repositories/
      player-repository.ts
      team-repository.ts
      draft-repository.ts
      ...
    services/
      draft-service.ts
      trade-service.ts
      season-service.ts
      ...
    simulation/
      game-simulator.ts
      player-progression.ts
      ...
    ai/
      gm-strategy.ts
      ...
  types/
    player.ts
    team.ts
    draft.ts
    ...
  schemas/
    # Zod validation schemas
  constants/
    # Enums, position lists, config constants
```

### Interface examples

```typescript
// packages/shared/interfaces/repositories/draft-repository.ts
export interface DraftRepository {
  getCurrentPick(draftId: string): Promise<DraftPick>;
  recordPick(pick: NewDraftPick): Promise<DraftPick>;
  getDraftOrder(draftId: string): Promise<PickSlot[]>;
}

// packages/shared/interfaces/services/draft-service.ts
export interface DraftService {
  makePick(input: PickInput): Promise<PickResult>;
  getCurrentPick(draftId: string): Promise<DraftPick>;
  autoDraft(draftId: string, teamId: string): Promise<PickResult>;
}
```

The server implements these. Tests mock them. The simulation and AI packages
depend on them without ever touching the server.

---

## Dependency Injection

### Factory functions

Every service and repository is created through a factory function that accepts
its dependencies as a typed parameter object.

```typescript
// server/features/draft/draft.repository.ts
import type { DraftRepository } from "@zone-blitz/shared";

export function createDraftRepository(deps: {
  db: DrizzleClient;
  log: pino.Logger;
}): DraftRepository {
  const log = deps.log.child({ module: "draft.repository" });

  return {
    async getCurrentPick(draftId) {
      log.debug({ draftId }, "fetching current pick");
      return deps.db.select().from(draftPicks).where(/* ... */).limit(1);
    },
    async recordPick(pick) {
      return deps.db.insert(draftPicks).values(pick).returning();
    },
  };
}
```

```typescript
// server/features/draft/draft.service.ts
import type { DraftRepository, DraftService, RosterRepository } from "@zone-blitz/shared";
import { isEligible } from "./draft-eligibility.ts";

export function createDraftService(deps: {
  draftRepo: DraftRepository;
  rosterRepo: RosterRepository;
  log: pino.Logger;
}): DraftService {
  const log = deps.log.child({ module: "draft.service" });

  return {
    async makePick(input) {
      const currentPick = await deps.draftRepo.getCurrentPick(input.draftId);
      if (currentPick.teamId !== input.teamId) {
        throw new DomainError("NOT_ON_CLOCK", "It's not your pick");
      }
      if (!isEligible(player, draftRules)) {
        throw new DomainError("INELIGIBLE", "Player cannot be drafted");
      }
      log.info({ draftId: input.draftId, teamId: input.teamId }, "pick made");
      const result = await deps.draftRepo.recordPick({ ... });
      await deps.rosterRepo.addPlayer(input.teamId, result.playerId);
      return result;
    },
  };
}
```

```typescript
// server/features/draft/draft.router.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { DraftService } from "@zone-blitz/shared";
import { pickInputSchema } from "@zone-blitz/shared";
import type { AuthedEnv } from "../../env.ts";
import { authenticated } from "../../middleware/auth.ts";

export function createDraftRouter(draftService: DraftService) {
  return new Hono<AuthedEnv>()
    .use(authenticated())
    .post("/pick",
      zValidator("json", pickInputSchema),
      async (c) => {
        const input = c.req.valid("json");
        const result = await draftService.makePick(input);
        return c.json(result);
      },
    )
    .get("/current-pick/:draftId", async (c) => {
      const pick = await draftService.getCurrentPick(c.req.param("draftId"));
      return c.json(pick);
    });
}
```

### Why factory functions, not classes

Factory functions returning interface-typed objects are lighter than classes. The
destructured `deps` parameter is constructor injection without the ceremony. The
return type is the interface — callers never see the implementation shape.

That said — if a feature grows complex enough that a class with methods reads
cleaner, use a class. The convention is **the interface**, not the
implementation shape.

### `mod.ts` — the feature's public API

Each feature exports its factory functions through `mod.ts`. The composition
root imports only from `mod.ts`, never from internal files.

```typescript
// server/features/draft/mod.ts
export { createDraftRepository } from "./draft.repository.ts";
export { createDraftService } from "./draft.service.ts";
export { createDraftRouter } from "./draft.router.ts";
```

### Composition root — `server/features/mod.ts`

The `server/features/mod.ts` file is the composition root. It creates all
repositories, services, and routers, wiring dependencies together. This is the
only place that knows which concrete implementations fulfill which interfaces.

```typescript
// server/features/mod.ts
import type { Database } from "../db/connection.ts";
import { logger } from "../logger.ts";
import { createDraftRepository, createDraftService, createDraftRouter } from "./draft/mod.ts";
import { createRosterRepository } from "./roster/mod.ts";
import { createLeagueRepository, createLeagueService, createLeagueRouter } from "./league/mod.ts";

export function createFeatureRouters(db: Database) {
  const log = logger;

  // Repositories
  const draftRepo = createDraftRepository({ db, log });
  const rosterRepo = createRosterRepository({ db, log });
  const leagueRepo = createLeagueRepository({ db, log });

  // Services
  const draftService = createDraftService({ draftRepo, rosterRepo, log });
  const leagueService = createLeagueService({ leagueRepo, log });

  // Routers
  const draftRouter = createDraftRouter(draftService);
  const leagueRouter = createLeagueRouter(leagueService);

  return { draftRouter, leagueRouter };
}
```

`main.ts` calls `createFeatureRouters` and mounts the returned Hono sub-apps.
See the [Hono RPC section](#hono-rpc) for the full picture.

One file to see every dependency relationship. No hidden singletons. Tests
bypass this entirely — they construct services with mocks directly.

---

## Hono RPC

Hono's built-in RPC client provides end-to-end type safety between the server
and client with no extra dependencies or code generation. Route definitions on
the server are the single source of truth — the client infers types directly
from them.

### Why Hono RPC over tRPC

- **Zero extra dependencies.** Already using Hono — no additional packages.
- **Standard HTTP.** Real routes, real REST semantics, standard fetch. Not a
  custom protocol tunneled through POST.
- **One routing model.** HTTP and WebSocket routes use the same Hono framework.
  Live drafts and trade negotiations need WebSockets — having one framework for
  both avoids maintaining two API paradigms.
- **Simpler stack.** No separate router/procedure/context/adapter layer on top
  of Hono.

### How it works

The key is **method chaining** on the Hono instance. When routes are chained,
Hono infers the full route tree as a type. Exporting that type gives the client
full type safety.

```typescript
// server/features/league/league.router.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { LeagueService } from "@zone-blitz/shared";
import { createLeagueSchema } from "@zone-blitz/shared";
import type { AuthedEnv } from "../../env.ts";
import { authenticated } from "../../middleware/auth.ts";

export function createLeagueRouter(leagueService: LeagueService) {
  return new Hono<AuthedEnv>()
    .use(authenticated())
    .post("/",
      zValidator("json", createLeagueSchema),
      async (c) => {
        const user = c.get("user");
        const input = c.req.valid("json");
        const league = await leagueService.create(user.id, input);
        return c.json(league);
      },
    )
    .get("/:id", async (c) => {
      const league = await leagueService.getById(c.req.param("id"));
      return c.json(league);
    });
}
```

Routers are thin — they validate input via `zValidator`, delegate to the
service, and return JSON. No business logic lives here.

### Authentication middleware

The `authenticated()` middleware resolves the session from Better Auth and
narrows the Hono context to include `user` and `session`. This replaces tRPC's
`protectedProcedure` pattern.

```typescript
// server/middleware/auth.ts
import type { MiddlewareHandler } from "hono";
import type { AuthedEnv } from "../env.ts";
import { auth } from "../auth/mod.ts";

export function authenticated(): MiddlewareHandler<AuthedEnv> {
  return async (c, next) => {
    const sessionData = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
    if (!sessionData?.user) {
      const log = c.get("log");
      log.debug("unauthorized request — no session");
      return c.json({ error: "UNAUTHORIZED" }, 401);
    }
    c.set("user", sessionData.user);
    c.set("session", sessionData.session);

    // Enrich logger with userId
    const log = c.get("log").child({ userId: sessionData.user.id });
    c.set("log", log);

    await next();
  };
}
```

```typescript
// server/env.ts
import type pino from "pino";

export type AppEnv = {
  Variables: {
    requestId: string;
    log: pino.Logger;
  };
};

export type AuthedEnv = {
  Variables: AppEnv["Variables"] & {
    user: User;
    session: Session;
  };
};
```

Feature routers that require authentication use `AuthedEnv` and apply
`authenticated()` as middleware. Public routes use `AppEnv` directly.

### App assembly and type export

The Hono app is assembled in `main.ts` by mounting feature routers. The chained
app type is exported for the client.

```typescript
// server/main.ts
import { Hono } from "hono";
import { db } from "./db/connection.ts";
import { createFeatureRouters } from "./features/mod.ts";
import { requestContextMiddleware } from "./middleware/request-context.ts";
import { loggerMiddleware } from "./middleware/logger.ts";
import { logger } from "./logger.ts";
import type { AppEnv } from "./env.ts";

const features = createFeatureRouters(db);

const app = new Hono<AppEnv>()
  .use(requestContextMiddleware(logger))
  .use(loggerMiddleware())
  .route("/api/leagues", features.leagueRouter)
  .route("/api/drafts", features.draftRouter);

// Auth routes
app.on(["GET", "POST"], "/api/auth/**", (c) => {
  return auth.handler(c.req.raw);
});

export type AppType = typeof app;
```

The `AppType` export is the key — it carries the full route tree as a type that
the client can consume.

### Client setup

The React client uses `hono/client` for typed API calls, paired with
`@tanstack/react-query` for caching and state management.

```typescript
// client/src/api.ts
import { hc } from "hono/client";
import type { AppType } from "../../server/main.ts";

export const api = hc<AppType>("/");
```

```typescript
// client/src/hooks/use-leagues.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";

export function useLeagues() {
  return useQuery({
    queryKey: ["leagues"],
    queryFn: async () => {
      const res = await api.api.leagues.$get();
      return res.json();
    },
  });
}

export function useCreateLeague() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const res = await api.api.leagues.$post({ json: input });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leagues"] });
    },
  });
}
```

Usage in components:

```typescript
function LeagueListPage() {
  const { data: leagues } = useLeagues();
  const createLeague = useCreateLeague();

  return (
    <>
      {leagues?.map((league) => (
        <LeagueCard key={league.id} league={league} />
      ))}
      <button onClick={() => createLeague.mutate({ name: "..." })}>
        Create League
      </button>
    </>
  );
}
```

### Zod validation with `zValidator`

Input validation uses `@hono/zod-validator`. Schemas are defined in
`@zone-blitz/shared` and used by both the server (validation) and client (form
validation, type inference).

```typescript
import { zValidator } from "@hono/zod-validator";
import { createLeagueSchema } from "@zone-blitz/shared";

// In a router:
.post("/",
  zValidator("json", createLeagueSchema),
  async (c) => {
    const input = c.req.valid("json");  // fully typed from the schema
    // ...
  },
)
```

Validation targets: `"json"` for request bodies, `"query"` for query
parameters, `"param"` for URL parameters.

---

## Logging

Pino is the logging library. The logging strategy provides structured,
request-traceable logs across all layers.

### Root logger

```typescript
// server/logger.ts
import pino from "pino";

const isProduction = Deno.env.get("DENO_ENV") === "production";

export const logger = pino(
  { level: isProduction ? "info" : "debug" },
  pino.destination({ sync: true }),
);
```

- `info` in production, `debug` in development.
- `pino.destination({ sync: true })` for Deno compatibility.
- Dev server pipes output through `pino-pretty` for human-readable formatting.

### Request context middleware

Every HTTP request gets a child logger with a unique `requestId`. The logger is
stored in Hono's typed context.

```typescript
// server/env.ts
export type AppEnv = {
  Variables: {
    requestId: string;
    log: pino.Logger;
  };
};

// server/middleware/request-context.ts
export function requestContextMiddleware(
  log: pino.Logger,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const requestId = c.req.header("X-Request-Id") ?? crypto.randomUUID();
    const requestLog = log.child({ requestId });

    c.set("requestId", requestId);
    c.set("log", requestLog);

    await next();
  };
}
```

### HTTP lifecycle logging

A middleware logs every request/response with status-based severity.

```typescript
// server/middleware/logger.ts
export function loggerMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const start = Date.now();
    await next();

    const log = c.get("log");
    const status = c.res.status;
    const data = {
      method: c.req.method,
      path: c.req.path,
      status,
      responseTime: Date.now() - start,
    };
    const msg = `${c.req.method} ${c.req.path}`;

    if (status >= 500) log.error(data, msg);
    else if (status >= 400) log.warn(data, msg);
    else log.info(data, msg);
  };
}
```

### Logger flow through DI

The root logger is passed into the composition root. Each factory creates a
module-scoped child logger:

```
Root logger (server/logger.ts)
  → composition root passes it to factories
    → repository: log.child({ module: "draft.repository" })
    → service: log.child({ module: "draft.service" })
```

For request-scoped logging (e.g., enriching with `userId`), the route handler
can pass `c.get("log")` into service method calls when needed.

### Test logger

Tests capture log output for assertions using a custom write stream:

```typescript
function createTestLogger() {
  const entries: Record<string, unknown>[] = [];
  const stream = {
    write(msg: string) {
      entries.push(JSON.parse(msg));
    },
  };
  const log = pino({ level: "debug" }, stream as pino.DestinationStream);
  return { log, entries };
}
```

---

## Domain Errors

Services throw typed domain errors. The HTTP layer catches them and maps to
status codes. The service layer has no concept of HTTP.

```typescript
// packages/shared/errors/domain-error.ts
export class DomainError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}
```

```typescript
// Hono error handler in main.ts
app.onError((err, c) => {
  if (err instanceof DomainError) {
    return c.json({ error: err.code, message: err.message }, 400);
  }
  const log = c.get("log");
  log.error({ err }, "unhandled error");
  return c.json({ error: "INTERNAL" }, 500);
});
```

---

## Extracting Domain Logic

When a service grows, extract pure computation into named domain logic files.

### The heuristic

If a function:

- Has **no dependencies** (no db, no logger, no injected services)
- Is **pure** (data in, data out, no side effects)
- Encodes a **named domain concept**

Then extract it into its own file named after that concept.

### Examples

```typescript
// server/features/draft/snake-order.ts
export function calculateSnakeOrder(
  totalTeams: number,
  totalRounds: number,
): PickSlot[] {
  // Pure computation — no deps, no DB, no logger
}
```

```typescript
// server/features/salary-cap/cap-proration.ts
export function prorateSigningBonus(
  totalBonus: number,
  contractYears: number,
  currentYear: number,
): number {
  // Pure math
}
```

The service imports and calls these. The domain logic is independently testable
without any mocking.

### When to use design patterns

Some extractions aren't single functions — they're behavioral variants. Use
patterns when the complexity warrants it:

**Strategy** — when the same operation has multiple implementations:

```
server/features/trade/
  evaluation/
    trade-evaluation.strategy.ts    # Interface
    win-now-evaluation.ts           # Weights current talent
    rebuild-evaluation.ts           # Weights draft picks
```

**Specification** — when business rules combine and compose:

```
server/features/salary-cap/
  rules/
    cap-compliance.rule.ts
    luxury-tax.rule.ts
    rookie-scale.rule.ts
```

These are domain concepts with names — not utilities.

---

## Simulation and AI Packages

The `simulation` and `ai` packages are separate Deno workspace members. They
are **pure** — no I/O, no database, no HTTP. They implement interfaces defined
in `@zone-blitz/shared`.

### Package structure

```
packages/
  shared/              # Interfaces, domain types, Zod schemas (no deps)
  simulation/          # Game engine — implements GameSimulator, etc.
  ai/                  # NPC decision-making — implements GMStrategy, etc.
```

### Dependency rules (hard constraints)

```
shared       → (no internal dependencies)
simulation   → shared only
ai           → shared only
server       → shared, simulation, ai
```

`simulation` and `ai` **never** depend on `server`. They have no knowledge of
databases, HTTP, or any I/O.

### Integration through DI

The server imports concrete implementations from `simulation` and `ai` at the
composition root and injects them where needed.

```typescript
// server/features/mod.ts
import { createGameSimulator } from "@zone-blitz/simulation";
import { createGMStrategy } from "@zone-blitz/ai";

export function createFeatureRouters(db: Database) {
  const log = logger;

  // ... repositories and services ...

  const gameSimulator = createGameSimulator();
  const gmStrategy = createGMStrategy();

  const seasonService = createSeasonService({
    gameSimulator,
    gmStrategy,
    leagueRepo,
    rosterRepo,
    log,
  });

  // ... routers ...

  return { /* ... */ };
}
```

### Future extraction path

When `simulation` or `ai` need to be extracted to Go/Rust:

1. The interfaces in `shared` become gRPC/HTTP service contracts.
2. The factory call in the composition root is replaced with an HTTP/gRPC client
   that implements the same interface.
3. Nothing else changes — the server still depends on the interface, not the
   implementation.

---

## Testing

### Service tests — mock dependencies via DI

```typescript
Deno.test("makePick throws if team is not on the clock", async () => {
  const service = createDraftService({
    draftRepo: {
      getCurrentPick: () => Promise.resolve({ teamId: "other-team", ... }),
      recordPick: () => { throw new Error("should not be called"); },
    },
    rosterRepo: {
      addPlayer: () => { throw new Error("should not be called"); },
    },
    log: pino({ level: "silent" }),
  });

  await assertRejects(
    () => service.makePick({ draftId: "d1", teamId: "my-team", ... }),
    DomainError,
    "NOT_ON_CLOCK",
  );
});
```

No test database, no mocking framework, no DI container. Construct the service
with fake deps and test the logic.

### Repository tests — hit a real database

Repository tests run against a real PostgreSQL instance. They verify Drizzle
queries and migrations work correctly. No mocking the database.

### Pure domain logic tests — no setup at all

```typescript
Deno.test("calculateSnakeOrder reverses direction each round", () => {
  const order = calculateSnakeOrder(4, 3);
  assertEquals(order[0].teamIndex, 0);  // Round 1: 0,1,2,3
  assertEquals(order[4].teamIndex, 3);  // Round 2: 3,2,1,0
  assertEquals(order[8].teamIndex, 0);  // Round 3: 0,1,2,3
});
```

### Simulation and AI tests — pure functions

These packages have no dependencies beyond `shared`. Tests pass in state and
assert output. No DB, no mocks, no DI.

---

## Cross-Feature Orchestration

Some operations span multiple features — season advancement, trade execution,
end-of-season processing. These are handled by **orchestrator features** that
depend on multiple service interfaces.

```typescript
// server/features/season/season.service.ts
export function createSeasonService(deps: {
  gameSimulator: GameSimulator;
  gmStrategy: GMStrategy;
  leagueRepo: LeagueRepository;
  rosterRepo: RosterRepository;
  draftRepo: DraftRepository;
  capRepo: SalaryCapRepository;
  log: pino.Logger;
}): SeasonService {
  return {
    async advanceWeek(leagueId) {
      // Orchestrates across all injected dependencies
    },
  };
}
```

The orchestrator feature may own a small schema (e.g., a `seasons` table) but
its primary role is coordination. Its dependency list in the factory signature
makes every cross-feature relationship explicit.

---

## Database

### Schema ownership

Each feature defines its own tables in its `.schema.ts` file. A top-level
`db/schema.ts` re-exports all feature schemas so `drizzle-kit` sees the
complete database.

```typescript
// server/db/schema.ts
export * from "../features/league/league.schema.ts";
export * from "../features/draft/draft.schema.ts";
export * from "../features/trade/trade.schema.ts";
export * from "../features/roster/roster.schema.ts";
// ...
```

### Passing `db` explicitly

The Drizzle client is passed through DI, not imported as a singleton. This
enables transactions at the service level:

```typescript
// In a service that needs a transaction
async executeTrade(trade: Trade) {
  return deps.db.transaction(async (tx) => {
    await deps.rosterRepo.transferPlayer(tx, trade.playerIds, trade.toTeamId);
    await deps.draftPickRepo.transferPicks(tx, trade.picks, trade.toTeamId);
  });
}
```

### Domain types vs. database types

The domain model in `shared` represents concepts as the simulation understands
them. The database schema represents how those concepts are stored. These are
not always the same. Repository implementations handle the mapping.
