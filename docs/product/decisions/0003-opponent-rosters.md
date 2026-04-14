# 0003 — Opponent rosters: public roster view + player history page

- **Date:** 2026-04-13
- **Status:** Accepted
- **Area:** roster — see
  [`../north-star/player-attributes.md`](../north-star/player-attributes.md),
  [`../north-star/statistics.md`](../north-star/statistics.md),
  [`../north-star/free-agency-and-contracts.md`](../north-star/free-agency-and-contracts.md),
  [`../north-star/salary-cap.md`](../north-star/salary-cap.md),
  [`../north-star/scouting.md`](../north-star/scouting.md)

## Context

The GM needs to look across the league and see how other teams are built — what
they're paying, who's under contract, and how players have performed. This is
the baseline "read the league" surface: what you could learn from a newspaper, a
cap site, and a box score. It is **not** a scouting surface — hidden attributes,
potential, personality traits, and scout verdicts never appear here. Those live
behind your actual scouting staff (see
[`scouting.md`](../north-star/scouting.md)) and cost time and money to generate.

The page also needs a player-level drill-down so the GM can study a specific
player's career the way he'd read a reference-style player page — where they
came from, where they've been, what they did.

## Decision

Ship two surfaces: an **Opponent Roster** view (one route per opposing team,
showing contracts and current-season statistics only) and a **Player Detail**
page (one route per player, showing the public historical record). Neither
surface exposes attributes, potential, scheme fit, scout grades, or any derived
"overall" number.

## Requirements

### Opponent Roster view

- List the full active roster of the selected opposing team, grouped by
  position.
- Per player, show: name, position, age, years of experience, contract years
  remaining, cap hit this season, total contract value, injury status.
- No overall rating, attribute reveal, potential grade, scout verdict, or
  scheme-fit indicator — not even qualitative ("a strong fit"). If it isn't
  public record, it isn't on this page.
- Show position-group totals: headcount and total cap $ per group.
- Show total roster cap $ and remaining cap space for the team.
- Sort/filter by position group, cap hit, age, contract years remaining.
- A separate **Statistics** tab with per-player current-season stats, same
  columns and position-group behavior as the roster page's statistics view (see
  [`0001-roster-page.md`](./0001-roster-page.md)). Prior-season and career
  totals available via selector.
- Each player row links to the player detail page.
- Read-only. No trade-propose, claim, or contact affordances on this surface —
  those live in the trading and free-agency flows.

### Player Detail page

One route per player, reachable from any roster (your own or an opponent's).
Sections, in order:

- **Header** — name, current team, position, age, height/weight, years of
  experience, injury status.
- **Origin** — draft year and round/pick (or "undrafted"), drafting team,
  college, hometown. Set at generation, never changes.
- **Contract** — current contract: years remaining, cap hit by season,
  guaranteed money, total value. Contract history: every deal he's signed, with
  team, years, total value, and how it ended (expired, released, traded,
  restructured, extended).
- **Career log** — season-by-season table: year, team, games played, games
  started, and the position-appropriate stat line for that season. Career totals
  row at the bottom. Playoff stats tracked separately.
- **Transactions** — chronological log: drafted, traded (to/from, with
  counterparties), signed, released, extended, franchise-tagged. The public
  paper trail of his career.
- **Accolades** — Pro Bowls, All-Pros, championships, league awards, major
  statistical milestones. Facts of record only.

### Out of scope

- Any attribute reveal, potential read, personality trait, or scheme fit
  assessment. That is the job of your scouting department, not this page.
- Scout reports, even your own, embedded in the opponent view — the player
  detail page is the public record, not your private intel. Your scouting notes
  surface on the scouting page.
- Depth chart of the opposing team. Public box scores reveal who started; this
  page does not reconstruct a depth chart from that. If we surface opponent
  depth charts later, it's a separate decision.
- Practice squad, IR, or weekly transaction log for the opposing team.
- Trade propose / offer flows from this page. Linking out to trading is allowed;
  initiating a trade is not.
- Messaging, contact, or tampering affordances on players under contract
  elsewhere.

## Alternatives considered

- **Single "league players" spreadsheet** — one giant table of every player in
  the league, filterable by team — rejected. Loses the team-as-unit framing that
  makes "how is that team built" legible (cap distribution by position group,
  roster shape), and turns the surface into a pure data dump.
- **Surface scout-graded evaluations on opponent rosters** — rejected. Collapses
  the scouting system into a free always-on overlay and erases the
  cost/time/uncertainty that makes scouting a meaningful GM decision.
- **Embed player detail inline as a drawer on the roster page** — rejected for
  the same reason as coach detail (see
  [`0002-coaches-page.md`](./0002-coaches-page.md)): career history is dense and
  deserves a shareable URL linkable from roster, trade, scouting, and
  free-agency surfaces.
- **Merge opponent roster and own roster into one parameterized page** —
  tempting, but rejected. The own-roster page carries actions (release, trade,
  restructure) and a depth chart view that do not apply to opponents, and the
  opponent view carries cross-team navigation (team picker, division framing)
  that doesn't apply to your own. Shared components, separate surfaces.

## Consequences

- Requires the sim to persist a complete public record per player: origin
  (draft/college/hometown), full contract history with termination reasons,
  season-by-season stat lines with team attribution, and a transaction log. Much
  of this already needs to exist for other systems; this page is the read model.
- Reinforces the scouting/coaching wall: if the user wants to know whether an
  opposing WR is actually fast or just scheme-boosted, they have to spend scout
  time, not click through the league browser. Market inefficiencies (see
  [`player-attributes.md`](../north-star/player-attributes.md) § Contracts and
  market value) stay real because public data stays public-only.
- The opponent roster view will feel spartan compared to rival games that paste
  OVRs everywhere. That is intentional and consistent with our own roster page.
- Future PRDs will cover: an opponent depth chart / starters view (if we decide
  it's worth surfacing), league-wide player search, and the scouting surface
  that overlays private evaluations onto these same player records.
