# Backlog

Lightweight list of follow-ups and small ideas we don't want to forget. Promote
an entry to a GitHub issue or a full document under `docs/incidents/` (or a
future `docs/action-items/`) once it grows past a one-liner.

Format: one bullet per item. Add a date and a short context line. Remove the
entry when it's resolved or superseded.

## Open

- **2026-04-14 — Archetype-aware player generation.** Decision 0006
  (positionless players) depends on the player generator producing
  archetype-shaped attribute profiles — "gun-slinger QB," "zone-blocking guard,"
  etc. — rather than uniform rolls. Also needs a rare cross-archetype case
  (Travis Hunter-style CB/WR) with a tunable rate. No player should be elite at
  every attribute; budgets/tradeoffs should enforce shapes. Scope this generator
  design before a large player-creation pass ships. See
  `docs/product/decisions/0006-positionless-players.md` "Note for the future —
  player generation toward archetypes."
- **2026-04-14 — Roster page release/trade/restructure flows.** The Active
  Roster view (decision 0001) lists release, trade, and restructure as
  per-player actions. Initial roster page PR ships these as disabled "coming
  soon" buttons. Build out each flow as its own feature once product priorities
  surface them.
- **2026-04-14 — Coach sim depth-chart publisher.** Decision 0001 requires the
  coach sim to publish a stable depth-chart artifact the roster page reads.
  Initial roster page stubs the source (empty depth chart until the sim writes
  rows). Wire the real producer when coach-side sim work begins.
- **2026-04-14 — Stack overflow in full-roster bulk insert during league
  creation.** Ran the full `leagueService.create` flow end-to-end against real
  Postgres (32 teams × 53 roster) and drizzle's `mergeQueries` stack-overflows
  while building the bulk `playerAttributes` insert (~1696 rows × ~50 attribute
  columns). Observed while writing the league-creation transactional rollback
  integration test — the integration test sidesteps this by stubbing
  `personnelService` with a single-row probe insert. Fix options: chunk the
  attribute insert, narrow the attribute row shape, or build the SQL
  iteratively. Split attribute rows into columns-per-table is overkill; chunked
  inserts are the cheapest fix.
- **2026-04-14 — Multi-user leagues would need a `user_leagues` join table.**
  The `last_played_at` column added in PR #105 lives directly on `leagues`,
  matching today's single-user-per-league assumption (each league has one
  `user_team_id`). If leagues ever become shared between multiple users, we'd
  need to move `last_played_at` (and anything else that's actually per-user)
  onto a `user_leagues` junction table keyed by `(user_id, league_id)` and join
  it into the list query.
- **2026-04-13 — Finer-grained league phase sub-states.** The `season.phase`
  enum only tracks `preseason | regular_season | playoffs | offseason`. Product
  docs (`docs/product/league-management.md`) describe sub-steps during the
  offseason (cut-down, draft, free agency, waiver periods). Decide whether to
  expand the enum, add a separate `offseasonStage` field, or model these as
  scheduled events. Surfaced while adding a league status column to the home
  page — today we can only show "Offseason" rather than "Drafting" or "Free
  Agency".
