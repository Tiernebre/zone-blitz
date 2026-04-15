# League Management

The league is the container for everything else. It defines the rules, schedule,
and structure within which all the strategic decisions play out. It needs to
support both single-player franchise experiences and online multiplayer leagues
seamlessly.

> **The canonical creation flow is League Genesis** — a brand-new startup league
> that founds small (8 teams by default), runs a one-time genesis sequence, and
> grows via expansion over many seasons. See
> [League Genesis](./league-genesis.md) for the full vision. This document
> covers the league **as a running system** across both a genesis-founded league
> and an established-mode league.

## League Modes

### Single-Player Franchise

You control one franchise as its owner/GM. The others are NPC-controlled. The
full experience:

- Complete control over your franchise's front office, coaching, and roster
- NPC franchises operate autonomously with distinct owner/GM AI personalities
- Play at your own pace — advance the season whenever you're ready
- The challenge is building and sustaining a dynasty against competent AI
  opponents over many seasons

### Multiplayer League

Multiple human owner/GMs, with NPC franchises filling remaining slots:

- Up to one human operator per franchise
- Remaining franchises are NPC-controlled
- Commissioner role with league management tools
- Synchronized season advancement (everyone must be ready to advance)
- Real-time events: live drafts, trade deadlines, free agency windows, expansion
  votes

### League Creation Options

When creating a league, the commissioner (or single-player founder) configures:

- **Creation mode**: **Genesis** (the default — brand-new startup league with a
  founding sequence; see [League Genesis](./league-genesis.md)) or
  **Established** (jump into a mature league with fictional history; secondary
  path)
- **Founding franchise count**: genesis default is **8**, configurable. The
  league grows from there via expansion over many seasons — see
  [Expansion](#expansion) below
- **Schedule length**: scales with league size. An 8-team league defaults to a
  shorter regular season (~10–12 games); 32 teams gets the standard 17-game
  season
- **Salary cap settings**: cap amount, growth rate, floor percentage
- **Draft settings**: rounds, pick timer, trade-up rules
- **Roster limits**: active roster size, practice squad size, IR spots
- **Difficulty / AI aggressiveness**: how tough NPC opponents are
- **Custom rules**: optional tweaks to standard NFL-style rules

## Expansion

A genesis-founded league is explicitly designed to grow. Expansion happens
through an **ownership vote** — every franchise (human-run and NPC alike) gets
one vote on any expansion proposal. Proposals can originate from any owner,
including you. If the vote passes, the league runs an expansion cycle
(establishment of new franchises, an expansion draft protecting/exposing
existing players, rookie-draft adjustments, and schedule/division realignment)
between seasons.

Natural scaling milestones unlock structural features as the league grows:

- **12 teams**: three divisions of four; a meaningful unbalanced schedule
- **16 teams**: four-division conference structure; a full wild-card playoff
  round
- **24 teams**: dual-conference structure with full inter-conference play
- **32 teams**: the canonical "mature league" size
- **Beyond 32**: expansion can continue for leagues that want a larger footprint

See
[League Genesis — Expansion Over Time](./league-genesis.md#expansion-over-time)
for the full narrative and voting mechanics.

## Season Structure

The season follows a calendar that creates natural pacing and drama.

> **Year 1 of a genesis league uses a different calendar.** The founding
> sequence (charter, franchise establishment, staff hiring, founding pool,
> allocation draft, free agency) replaces the normal offseason, and **Year 1 has
> no preseason** — the league doesn't yet have the infrastructure for exhibition
> games. Starting in Year 2, the league settles into the calendar described
> below. See
> [League Genesis — The Inaugural Calendar](./league-genesis.md#the-inaugural-calendar).

### Offseason

1. **Season awards and review** — MVP, All-Pro selections, end-of-season recaps
2. **Coaching carousel** — firings, hirings, coordinator changes
3. **Combine and pro days** — public prospect evaluation
4. **Free agency** — legal tampering, then open market
5. **Draft** — the main event
6. **UDFA signing period** — post-draft free agents
7. **OTAs and minicamp** — early roster evaluation (abstracted)

### Preseason

- Roster battles for final roster spots
- Evaluation of rookies and bubble players
- Cut-down from 90 to 53 (multiple rounds of cuts)
- Practice squad formation

### Regular Season

- Weekly game simulation
- Waiver wire and free agent signings
- Trade window (open until the deadline)
- Injury management and roster adjustments
- Bye weeks

### Trade Deadline

A fixed point in the season after which no trades can occur. Creates urgency and
drama.

### Playoffs

- Conference-based playoff bracket
- Single elimination
- Super Bowl

### Awards and End of Season

- MVP, Offensive/Defensive Player of the Year, Rookie of the Year, etc.
- All-Pro teams
- Pro Bowl selections (affects conditional pick resolutions)
- Contract expirations — which players become free agents?

## Multiplayer Coordination

### Season Advancement

The trickiest multiplayer design problem. Options:

- **Commissioner-controlled**: The commissioner advances the season when they
  decide everyone is ready
- **Ready-check system**: Each human GM marks "ready" — season advances when all
  are ready (or after a configurable timeout)
- **Scheduled advancement**: Leagues set a real-world schedule (e.g., advance
  every 48 hours). You have until the deadline to make your moves.
- **Hybrid**: Different phases advance differently. Free agency might be
  real-time; regular season weeks might be on a timer.

### Commissioner Tools

- Force-advance the season
- Pause the league
- Veto trades
- Adjust league settings mid-season
- Manage NPC team assignments (replace a departing human GM with AI, or assign a
  new human to an NPC team)
- Handle disputes

### Handling Absent Managers

When a human GM goes inactive:

- Auto-pilot mode: their team runs on NPC AI until they return
- Commissioner can reassign the team to a new human or permanently convert to
  NPC
- Auto-draft with pre-set board for absent GMs during drafts
- Notification system to remind inactive managers to make their moves

## League History and Stats

A franchise sim lives and dies by its historical record:

### Record Book

- All-time leaders in every statistical category
- Team records: wins, losses, championships
- Season-by-season standings and results
- Playoff brackets and results for every season

### Player History

- Full career stats across all seasons
- Transaction history: drafted, traded, signed, released
- Awards and accolades
- Hall of Fame induction (based on career accomplishments)

### Draft History

- Every draft class, pick by pick
- Retrospective grades: how did each draft class turn out years later?
- Scouting accuracy tracking: how well did your scouts evaluate prospects?
- Bust and steal tracking

### Trade History

- Every trade, with full details
- Outcome tracking: which side "won" each trade in retrospect?

### League Timeline

A narrative history of the league:

- Championship winners
- Dynasty identification
- Notable trades and free agent signings
- Records broken
- Rivalries that developed organically

This history is what gives a 20-season franchise its weight. Every decision you
made is recorded, and you can look back and trace the consequences.

## Related decisions

- [0014 — Season calendar and phase state machine](../decisions/0014-season-calendar-phase-state-machine.md)
