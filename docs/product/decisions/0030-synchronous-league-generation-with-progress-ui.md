# 0030 — Synchronous league generation with progress UI

- **Date:** 2026-04-15
- **Status:** Accepted
- **Area:** [League Genesis](../north-star/league-genesis.md),
  [Coaches](../north-star/coaches.md), [Scouting](../north-star/scouting.md)

## Context

After the founder submits the team-select step (ADR 0027 step 3), the system
needs to create a substantial amount of per-league content before the dashboard
can render:

- 8 franchise rows (one claimed by the founder, seven NPC) with identities
- Per-league unique coaches and scouts generated for every franchise (ADR 0022 —
  per-league unique coach/scout generation)
- The founding player pool (ADR 0026)
- Initial league-clock state positioned at the first in-dashboard genesis phase
  (ADR 0031)

This work is not instantaneous — it involves generating and persisting hundreds
of entities — but it's also not so slow that it needs a background job with
resumability. The question is whether the wizard's fourth step is a synchronous
"create everything then redirect" request with a loading state, or an
asynchronous job the founder polls or gets pushed updates about.

## Decision

**League generation in the MVP runs synchronously during the wizard's fourth
step. The founder's browser shows a loading spinner with descriptive progress
copy ("Creating coaches and league foundation…") while the server generates
coaches, scouts, NPC franchises, and the founding player pool in a single
transaction (or logically-atomic sequence). When generation completes, the
server responds and the client redirects straight into the dashboard.**

There is no background job, no polling endpoint, no resumability, and no
partial-success state in v1. If generation fails, the league is not created and
the founder sees an error state they can retry from step 3.

The loading UI may surface a small number of named progress milestones —
"creating coaches", "assembling the founding player pool", "founding the league"
— but these are narrative, not a real-time progress bar tied to server events.
The server runs generation to completion and the client waits.

## Alternatives considered

- **Background job with polling/streaming progress.** More robust if generation
  gets slow, but adds a job queue, a progress channel, and a reconnection story
  before the MVP needs any of that. Defer until generation actually becomes slow
  enough to matter.
- **Lazy generation — create minimal league on submit, generate coaches / pool
  on first dashboard access.** Avoids the spinner but spreads the cost into
  dashboard rendering, where a slow load is _worse_ because it masquerades as a
  broken app rather than an understood setup step. Also complicates the mental
  model: is the league "done" after submit or not?
- **Pre-generate leagues into a pool and assign on claim.** Fastest perceived
  creation time, but ADR 0022 requires coaches and scouts to be unique per
  league — that uniqueness is a hook the north-star uses for long-run narrative
  value, not a generation-time optimization target. Pre-generation would either
  violate that uniqueness or produce pools of leagues that go unused.
- **Silent spinner with no progress copy.** Works, but the north-star explicitly
  frames genesis as a narrative moment. Naming what's happening ("creating
  coaches", "founding the league") sets the tone in a way a generic spinner does
  not, and it's essentially free.

## Consequences

- **Makes easier:** the server implementation. One request, one transaction, one
  response. Failure modes are "it worked" or "it didn't"; there's no partial
  state to reconcile.
- **Makes easier:** the client implementation. A single in-flight request with a
  loading state, no websocket or polling loop.
- **Makes easier:** observability. Generation is a single server operation, so
  its duration and failure rate are one metric each.
- **Makes harder:** scaling generation runtime. If generation grows past a few
  seconds, the synchronous request starts to feel broken even with good loading
  copy. We accept this as a future problem; when it becomes real, migrating to a
  job + polling/streaming is a discrete follow-up.
- **Makes harder:** resuming a mid-failure generation. There is no resume — a
  failed generation leaves no league and the founder restarts from team select.
  This is acceptable because partial leagues are worse than no league.
- **Follow-up work:** instrument generation duration from day one so we know
  when the synchronous model starts to strain. When it does, the follow-up ADR
  covers the job-based migration.
