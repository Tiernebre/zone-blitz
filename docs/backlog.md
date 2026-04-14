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
- **2026-04-14 — Front office staff schema needs role/title columns.** The
  `front_office_staff` table (and the `FrontOfficeStaff` shared type) only
  carries `firstName` / `lastName` beyond identifiers, which is why the
  graduated front-office generator can only vary names. Adding role (`GM`,
  `President of Football Ops`, `Capologist`, `Director of Player
  Personnel`,
  etc.) plus age / contract / philosophy fields would let the generator produce
  realistic front-office variance on the same tier-band pattern coaches and
  scouts now use. Until then the generator is rename- only — code is in place to
  consume an injected `nameGenerator`, so the expansion will be a localized
  edit.
