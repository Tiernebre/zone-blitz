# 0013 — Player detail page: biography, contract, and transaction history

- **Date:** 2026-04-14
- **Status:** Accepted — extends the Statistics view in
  [`0001-roster-page.md`](./0001-roster-page.md).
- **Area:** roster, contracts, transactions — see
  [`../north-star/player-attributes.md`](../north-star/player-attributes.md),
  [`../north-star/statistics.md`](../north-star/statistics.md),
  [`../north-star/free-agency-and-contracts.md`](../north-star/free-agency-and-contracts.md),
  [`../north-star/salary-cap.md`](../north-star/salary-cap.md),
  [`../north-star/trading.md`](../north-star/trading.md).

## Context

Player names appear in tables all over the app — roster, depth chart, opponent
rosters, free agency, draft board, transaction logs, scouting lists. Today those
names are plain text. The GM has nowhere to go when a name catches his eye, and
the roster page's statistics view already says "per-player row links to a detail
view" (ADR 0001) without defining what that view is.

A player's story is spread across stats, contract, and transactions. Surfacing
each of those on its own page would fracture the narrative and force the user to
stitch it together. Basketball-Reference, Pro-Football-Reference, NFL.com, and
ESPN all converge on the same shape: one canonical page per player, biography at
the top, career stats and contract below. That convergence is the design.

## Decision

Ship a single **Player Detail** page at one canonical route per player
(`/players/:playerId`), reachable by clicking the player's name anywhere a
player appears in a table. The page shows biography, career statistics, a
year-by-year contract breakdown, and a transaction history — on one page, no
tabs for sections that fit in a scroll.

### Navigation back to the previous page

Rely on the **browser back button** and a **breadcrumb to the canonical parent**
(the player's current team roster). Do _not_ render a generic "← Back" link that
tries to guess where the user came from.

Reasoning:

- The page is reachable from many surfaces (own roster, opponent roster, free
  agency, draft board, transaction log, scouting list, trade block). A single
  "Back" link would lie in at least half of those cases — "back to roster" is
  wrong when the user arrived from free agency.
- The browser back button already knows where the user came from, is always
  present, works across deep-link entry (URL paste, refresh, shared link), and
  is universally understood. Re-implementing it as an in-page link is a worse
  copy of a free feature.
- Breadcrumbs encode the _canonical_ hierarchy (Team → Roster → Player), which
  is stable regardless of the user's path. That is genuinely useful — it lets
  the user jump up a level without assuming where they came from.

If a specific flow needs a labeled return link (e.g. "Back to Free Agency"
inside a multi-step FA evaluation), that belongs to the flow, not the player
page.

## Requirements

One route, one page, scrollable. Sections in order:

### Header / biography

- Headshot. NPC players use the generic silhouette from ADR 0004 until a real
  portrait system lands; no per-player portrait blocks shipping this page.
- Name, jersey number, position, team, status (active / IR / suspended / free
  agent / retired).
- Physical: height, weight.
- Background: age + birthdate, hometown, college (or "undrafted free agent" /
  international path where applicable).
- Experience: years in the league, draft info (year, round, pick, drafting
  team), Pro Bowl / All-Pro counts if any.
- Breadcrumb: `<Team name> › Roster › <Player name>` for rostered players;
  `Free Agents › <Player name>` for FAs; `Draft <year> › <Player name>` for
  pre-draft prospects. No in-page "Back" link.

No overall rating, no scout grade, no attribute bars — same rule as ADR 0001.
Judgment comes from stats, contract, and career arc, not a number.

### Statistics

- Career table, one row per season, plus a Career Totals row.
- Columns adapt to position group (same rule as the roster statistics view in
  ADR 0001 — passing for QB, rushing for RB, receiving for WR/TE, defensive for
  front seven / secondary, kicking/punting for specialists).
- Per season, show team and games played alongside the stat columns so a
  mid-season trade is legible.
- Link to game-by-game splits for the current season (the detail view ADR 0001
  already references). Prior-season splits are out of scope here.
- Stats reflect sim output only; no projections.

### Contract — year-by-year breakdown

- A row per contract year: base salary, signing bonus proration, roster /
  workout bonuses, cap hit, dead cap if cut, cash paid that year.
- Separate rows for void years where they exist; flag them as void.
- Totals row: full contract value, guaranteed at signing, cash-to-date.
- Header on the contract block: signed date, length, team at signing, contract
  type (rookie scale, veteran, extension, franchise tag, restructure).
- Prior contracts collapse below the current one, same shape.
- For rookie-scale deals, label the block as rookie scale (per ADR 0011 — the
  market multiplier does not apply) so the cap hit is legible as slotted, not
  negotiated.

### Transaction history

- Reverse-chronological log of everything that moved this player: drafted,
  signed (rookie / FA / extension), traded, released, claimed on waivers, placed
  on IR, activated, suspended, retired.
- Each row: date, type, parties involved (links to team / coach / GM where
  applicable), and the cap / compensation terms of the transaction (trade
  compensation, cap savings on release, etc.).
- Trades link to the other side of the deal so the user can follow the full
  trade from either player's page.

### Out of scope

- Editing anything from this page — no release / trade / restructure buttons.
  Those actions live on the roster page and feed into their own flows; the
  detail page is an inspection surface.
- Attribute reveals, scout verdicts, OVR, development curves, projected stats.
- Per-game splits beyond the current season (future work).
- Player comparison view (future work).
- Social / media coverage of the player (belongs to
  [`../north-star/media.md`](../north-star/media.md), not here).
- Real portraits — defer until the portrait system exists (ADR 0004).

## Alternatives considered

- **Tabs for Stats / Contract / Transactions.** Rejected. The three sections are
  the whole story and are individually short; tabs hide two-thirds of the page
  behind a click and break Ctrl-F over the full record. A single scroll matches
  the reference sites (BR, PFR, NFL, ESPN) and is what users expect.
- **Drawer / modal from the roster table.** Rejected. The page needs a shareable
  URL (deep-linking from transaction logs, trade histories, opponent scouting)
  and is too dense for a drawer. Same reasoning as the Coach Detail page (ADR
  0002).
- **Generic "← Back" link at the top of the page.** Rejected — see the
  navigation section above. A link that guesses the referrer is worse than the
  browser back button plus a canonical breadcrumb.
- **Split biography / stats / contract into separate routes.** Rejected.
  Fractures the narrative; every reference site has converged on a single page
  for a reason.
- **Show ratings / OVR on the detail page since "the user is already committed
  to this player."** Rejected. Violates the same invariant as ADR 0001 and ADR
  0002: judgment comes from the record, not a number. Making the rule
  conditional on depth of navigation is how the number creeps back everywhere.

## Consequences

- Every table that renders a player row now has a canonical link target. Roster
  (ADR 0001), opponent rosters (ADR 0003), scouts lists (ADR 0003), draft, free
  agency, and transaction logs all link to the same route.
- Requires the sim to publish stable per-player artifacts: career stats by
  season, the full contract ledger (including prior contracts), and a
  transaction log keyed by player. The contract ledger needs to be rich enough
  to reconstruct cap hits and dead money per year, not just headline total.
- The contract block is the first place the positional market (ADR 0011) becomes
  directly visible to the user — an 85-overall QB's numbers read very
  differently from an 85-overall RB's on this page. That is intended.
- Transaction history makes trades a two-sided data structure — linking both
  players' pages to the same trade record. Later work on a dedicated
  "transactions" surface will reuse that record.
- Deferred follow-ups (filed as issues, per CLAUDE.md): real portraits for named
  players; game-by-game splits for prior seasons; player comparison view; media
  coverage module.
