# Backlog

Lightweight list of follow-ups and small ideas we don't want to forget. Promote
an entry to a GitHub issue or a full document under `docs/incidents/` (or a
future `docs/action-items/`) once it grows past a one-liner.

Format: one bullet per item. Add a date and a short context line. Remove the
entry when it's resolved or superseded.

## Open

- **2026-04-14 — Scheme lens on scouting / FA / draft surfaces.** ADR 0006
  requires scout reports, free-agent shortlists, and draft boards to surface
  players as archetypes-in-role ("slot WR," "3-tech," "box safety") when
  projected through the hired coach's fingerprint, and `null` / "not a fit" when
  the player has no role in that scheme. Today those surfaces still read the
  neutral bucket only. Needs a
  `schemeLens(attributes, fingerprint) →
  archetype | null` mapping — richer
  than the qualitative Scheme Fit label shipped in #148 — plus consumer wiring
  in the scouts, FA, and draft features.
- **2026-04-14 — Extend Scheme Fit badge to salary-cap and opponent-roster
  tables.** `RosterPlayer.schemeFit` is on the wire everywhere but only the
  Roster page renders the badge. Salary cap and opponents detail already have
  the field in their fixtures — just add the column.
- **2026-04-14 — Cross-archetype player generation (Travis Hunter case).** ADR
  0009 ships the archetype-aware player generator but defers the rare
  cross-archetype roll: a small, tunable fraction of generated players should
  qualify for two non-specialist neutral buckets (e.g. CB + WR). Wire this into
  the generator with a rate knob, and surface both bucket lenses in the scout /
  depth-chart / draft UIs.
- **2026-04-14 — Coach sim depth-chart publisher.** Decision 0001 requires the
  coach sim to publish a stable depth-chart artifact the roster page reads.
  Initial roster page stubs the source (empty depth chart until the sim writes
  rows). Wire the real producer when coach-side sim work begins.
- **2026-04-14 — Player detail view with per-game splits.** Roster Statistics
  view is specified to link each row to a detail view with game-by-game splits
  (decision 0001). Initial PR ships without that detail route; add the page when
  per-game sim output lands.
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
- **2026-04-13 — Finer-grained league phase sub-states.** The `season.phase`
  enum only tracks `preseason | regular_season | playoffs | offseason`. Product
  docs (`docs/product/league-management.md`) describe sub-steps during the
  offseason (cut-down, draft, free agency, waiver periods). Decide whether to
  expand the enum, add a separate `offseasonStage` field, or model these as
  scheduled events. Surfaced while adding a league status column to the home
  page — today we can only show "Offseason" rather than "Drafting" or "Free
  Agency".
