# Backlog

Lightweight list of follow-ups and small ideas we don't want to forget. Promote
an entry to a GitHub issue or a full document under `docs/incidents/` (or a
future `docs/action-items/`) once it grows past a one-liner.

Format: one bullet per item. Add a date and a short context line. Remove the
entry when it's resolved or superseded.

## Open

- **2026-04-14 — Implement positional market value table (ADR 0011).** Replace
  ADR 0009's premium/mid/base tier buckets with a per-position market
  multiplier + convex-at-top curve (QB 1.80 down to LS 0.20; RB depressed at
  0.65). Single exported module consumed by the contract generator and the
  future FA valuation code. Rookie-scale deals stay exempt. Tests pin the QB:RB
  ~2.75× headline invariant and ordering, not exact numbers.
- **2026-04-14 — Implement league-creation cap situations (ADR 0010).** Assign a
  cap-situation archetype (Cap Hell / Tight / Balanced / Flush) per team at
  league creation, bias contract generation so team totals land in the
  archetype's band (replacing ADR 0009's uniform post-hoc scale), correlate
  roster shape (age / star density) with archetype, and surface the badge +
  committed/available numbers on the team-select screen. Allow Cap Hell to start
  slightly over the cap; first-offseason compliance flow is a prerequisite
  before advancing past that offseason.
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
