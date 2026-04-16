# Product Vision

An open-source, web-based football franchise simulation game focused on the
front-office experience: scouting, drafting, trading, and team-building
strategy.

This is not an action game. You never control a player on the field. You are the
General Manager. You build the roster, hire the coaches, scout the prospects,
make the trades, manage the cap, and live with the consequences for years to
come.

## Inspirations

- **Front Office Football** — deep football simulation with granular roster and
  scheme control
- **Out of the Park Baseball** — the gold standard for sports franchise sims;
  rich NPC AI, deep draft/scouting, decades-long franchise arcs
- **ZenGM Basketball** (zengm.com) — accessible, browser-based, open-source
  sports sim that proves the model works on the web

## Core Principles

### Scouting and drafting are the core gameplay

The most fun part of being a GM is the draft. Building a board, dispatching
scouts, debating whether to trade up, and sweating as your guy falls (or
doesn't). Every other system feeds into this: your scheme determines what you
need, your cap situation determines whether you can sign a veteran instead, your
scouting determines how much you actually know about a prospect.

### Information asymmetry drives decisions

You never see a player's "true" ratings. You see what your scouts have
uncovered, filtered through their accuracy and biases. A prospect might look
like a sure thing or a reach depending on how well you've scouted them. This
uncertainty is the game.

### Every decision connects to every other decision

A trade affects your cap space, which affects free agency, which affects your
draft needs, which affects your scouting priorities, which depends on your
scheme, which depends on your coaching staff. This interconnected web of
consequences is what makes franchise mode compelling over dozens of seasons.

### The league feels alive

NPC teams aren't filler. They have distinct personalities, make proactive
decisions, trade with each other, compete for free agents, and create storylines
you didn't cause. Checking the league news feed should surface surprises.

### Multiplayer is a first-class experience

Online leagues with friends are the ultimate expression of this game. Live
drafts, real-time trade negotiations, competing for the same free agents, and
trash-talking your way through a rivalry. Single-player should be great, but
multiplayer is where the game reaches its potential.

## How this folder is organized

- **[`north-star/`](./north-star/)** — evergreen vision documents that describe
  _what each feature area is_ and the principles that guide it. Update these
  when something materially changes the rules of a domain.

## Feature Areas (north star)

Each of these has a dedicated vision document:

- [Scouting](./north-star/scouting.md) — the information engine; scout
  management, evaluation process, and the multi-year feedback loop
- [Drafting](./north-star/drafting.md) — prospect generation, the draft board,
  draft day, and post-draft
- [Schemes & Strategy](./north-star/schemes-and-strategy.md) — football identity
  and personnel philosophy
- [Trading](./north-star/trading.md) — negotiation, deal-making, and the social
  game
- [Salary Cap Management](./north-star/salary-cap.md) — the cap constraint,
  contract structure, and multi-year financial planning
- [Free Agency & Contracts](./north-star/free-agency-and-contracts.md) — market
  competition, player decisions, and the bidding game
- [NPC AI](./north-star/npc-ai.md) — making the league feel alive with distinct,
  intelligent opponents
- [League Management](./north-star/league-management.md) — seasons, scheduling,
  and the multiplayer experience
- [Game Simulation](./north-star/game-simulation.md) — what happens on the field
- [Player Attributes](./north-star/player-attributes.md) — the true 0-100 scale,
  hidden potential, and progression
- [Statistics](./north-star/statistics.md) — sim-driven stats for players,
  teams, and the league; the primary feedback loop for GM decisions
- [Coaches](./north-star/coaches.md) — the coaching staff; hidden attributes,
  coaching trees, the GM-coach relationship, and the coaching market
- [Media](./north-star/media.md) — analysts, headlines, grades, narratives, and
  the mechanical effects of public perception
- [League Genesis](./north-star/league-genesis.md) — startup-league vision:
  founding small, growing via expansion, and the founder as owner-and-GM
- [Teams & Branding](./north-star/teams-and-branding.md) — fictional franchises,
  market size, relocation, divisions, visual identity, and custom team uploads
