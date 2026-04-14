# CLAUDE.md

## Git

- Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for
  all commit messages.
- Format: `<type>(<optional scope>): <description>`
- Include a detailed body explaining **why** the change was made, not just what
  changed.
- Common types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `build`,
  `ci`
- Example:
  ```
  feat(draft): add snake draft pick order logic

  Implements the snake draft algorithm where pick order reverses
  each round. This is the most common draft format requested by
  users and is needed before the real-time draft room can function.
  ```

## Documentation

- **Product/domain docs:** [`docs/product/`](./docs/product/) — split into
  [`north-star/`](./docs/product/north-star/) (evergreen vision per feature
  area; ubiquitous language, entities, and rules) and
  [`decisions/`](./docs/product/decisions/) (dated, ADR-style records of
  specific product decisions). Read the relevant north-star doc before working
  on a feature; check decisions for the _why_ behind specific rules.
- **Architecture:**
  [`docs/technical/architecture.md`](./docs/technical/architecture.md) — stack
  overview, monorepo structure, dependency rules, deployment model.
- **Backend patterns:**
  [`docs/technical/backend-architecture.md`](./docs/technical/backend-architecture.md)
  — feature structure, DI via factory functions, Hono RPC, logging, domain
  errors.
- **UI architecture:**
  [`docs/technical/ui-architecture.md`](./docs/technical/ui-architecture.md) —
  React SPA structure, feature/flow/component organization, shadcn/ui usage.
- **Incidents:** [`docs/incidents/`](./docs/incidents/) — postmortems with root
  cause analysis and action items.
- **Backlog:** [`docs/backlog.md`](./docs/backlog.md) — lightweight list of
  follow-ups and small ideas. Promote entries to issues or full docs once they
  outgrow a one-liner. When you notice a follow-up during a session (deferred
  cleanup, a rough edge spotted in passing, a decision we punted on), append a
  dated bullet here rather than letting it drop.

## Testing

- Follow strict **test-driven development (TDD)** with red-green-refactor
  cycles. This is not optional.
  1. **Red** — Write a failing test against a spec or interface. The
     implementation does not exist yet.
  2. **Green** — Write the minimum code to make the test pass.
  3. **Refactor** — Clean up the implementation while keeping tests green.
- Never write implementation before a failing test. Tests drive the design.
- **Code coverage thresholds are enforced.** CI will fail if coverage drops
  below the configured minimums (85% for Deno server/packages, 95% for client).
  - Deno tests (server/packages): `deno test --coverage` +
    `deno task test:coverage` (runs `bin/check-coverage`)
  - Client tests (Vitest): coverage thresholds configured in
    `client/vite.config.ts` via `@vitest/coverage-v8`

## Workflow

- Always work in a git worktree when making code changes. Use the
  `EnterWorktree` tool before starting implementation to avoid conflicts with
  parallel sessions.
- **Never push directly to `main`.** Every change — even one-line fixes — goes
  through a pull request so CI runs against it _before_ it can affect the deploy
  pipeline.
- Keep PRs small and frequent — one logical change per PR.
- Standard PR flow for each change:
  1. In the worktree, create a feature branch and push it:
     `git push -u origin HEAD:<branch-name>`.
  2. Open the PR against `main` with `gh pr create`.
  3. Enable auto-merge immediately: `gh pr merge --auto --squash` (or `--merge`
     if a linear history is preferred for that change). Auto-merge will merge
     the PR the moment required checks pass, without requiring another
     round-trip.
  4. Watch CI with `gh run watch` / `gh pr checks --watch`. If checks fail, fix
     on the same branch and push again — do not merge manually to bypass.
  5. After the PR merges, run `git fetch origin main:main` locally so the
     worktree's `main` ref catches up.
- After a PR is pushed, immediately exit/delete the worktree and return to
  `main`.
- PR descriptions should include a **Summary** section only. Do not add a test
  plan section.
