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

## Domain

- Domain documentation lives in [`docs/domain/`](./docs/domain/). Read the
  relevant domain doc before working on a feature to understand the ubiquitous
  language, entities, and rules.

## Testing

- Follow strict **test-driven development (TDD)** with red-green-refactor
  cycles. This is not optional.
  1. **Red** — Write a failing test against a spec or interface. The
     implementation does not exist yet.
  2. **Green** — Write the minimum code to make the test pass.
  3. **Refactor** — Clean up the implementation while keeping tests green.
- Never write implementation before a failing test. Tests drive the design.

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
