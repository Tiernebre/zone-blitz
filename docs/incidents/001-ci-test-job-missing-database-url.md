# Incident 001: CI test job missing DATABASE_URL

## Summary

The CI test job failed on PR #17 because repository integration tests required a
`DATABASE_URL` environment variable and database migrations, but neither was
configured in the workflow despite a Postgres service container already being
present.

## Timeline

| Time       | Event                                                                 |
| ---------- | --------------------------------------------------------------------- |
| 2026-04-12 | PR #17 opened adding league repository integration tests              |
| 2026-04-12 | CI test job failed — `DATABASE_URL is required for integration tests` |
| 2026-04-12 | Root cause identified and fix pushed to same PR                       |
| 2026-04-12 | All CI checks pass after fix                                          |

## Root Cause

PR #15 added a Postgres service container to the CI test job in anticipation of
integration tests, but did not set the `DATABASE_URL` environment variable on
the test step or include a migration step. When PR #17 introduced the first
repository tests that actually connect to the database, the missing env var
caused an immediate failure.

The other jobs that use Postgres (e2e, docker-smoke) already had `DATABASE_URL`
configured, so the gap was specific to the test job.

## Resolution

Added two steps to the test job in `.github/workflows/ci.yml`:

1. A migration step (`deno task db:migrate`) with `DATABASE_URL` pointing at the
   service container.
2. The `DATABASE_URL` env var on the test step itself.

## Lessons Learned

### What went well

- The Postgres service container was already correctly configured with health
  checks, so the fix was minimal.
- Failure was caught immediately on the first PR that needed it.

### What could be improved

- When adding infrastructure (service containers), also wire up the environment
  variables and any setup steps (migrations) at the same time, even if no tests
  use them yet. This avoids a "works on my machine" gap where local `.env` files
  mask missing CI config.

## Action Items

- [x] Add `DATABASE_URL` and migration step to CI test job (PR #17)

## References

- PR #17: https://github.com/Tiernebre/zone-blitz/pull/17
- Failed run:
  https://github.com/Tiernebre/zone-blitz/actions/runs/24317316594/job/70997184193
