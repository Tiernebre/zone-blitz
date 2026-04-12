# Zone Blitz

An open-source football franchise simulation game. Build your front office,
scout prospects, scheme your playbook, and compete in online leagues.

**https://zoneblitz.app**

## Prerequisites

- [Deno](https://deno.land/) (runtime & task runner)
- [Docker](https://www.docker.com/) (PostgreSQL via Docker Compose)

## Getting Started

```sh
deno task setup    # install dependencies, start DB, run migrations
deno task dev      # start the dev server (server + client)
```

## Project Structure

```
zone-blitz/
├── server/          # Deno backend (Oak/Hono HTTP server)
│   ├── db/          # Database migrations & Drizzle config
│   └── middleware/   # HTTP middleware
├── client/          # React frontend (Vite)
│   └── src/
├── packages/
│   └── shared/      # Shared types/utilities across server & client
├── e2e/             # End-to-end tests (Playwright)
├── docs/
│   ├── product/     # Product/domain design docs
│   └── technical/   # Architecture & technical docs
├── bin/             # Dev scripts (setup, dev, test-e2e)
├── scripts/         # SQL & helper scripts
└── deno.json        # Workspace config & task definitions
```

## Commands

| Command | Description |
| --- | --- |
| `deno task setup` | One-time setup: deps, DB, migrations |
| `deno task dev` | Start server + client in dev mode |
| `deno task db:start` | Start PostgreSQL (Docker Compose) |
| `deno task db:stop` | Stop PostgreSQL |
| `deno task db:migrate` | Run database migrations |
| `deno task test` | Run all unit/integration tests (server + client) |
| `deno task test:server` | Run server tests |
| `deno task test:client` | Run client tests (Vitest) |
| `deno task test:e2e` | Run end-to-end tests (Playwright) |
| `deno task build` | Build the client for production |
| `deno task start` | Start the production server |

## License

See [LICENSE](./LICENSE).
