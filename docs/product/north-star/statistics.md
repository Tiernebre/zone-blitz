# Statistics

Statistics are how the GM reads the team. Every decision — who to re-sign, who
to cut, which coach is working, which scheme is breaking down — gets argued in
numbers. If the sim can't produce realistic NFL stats, none of those arguments
hold up.

## Principles

### Stats are sim output, never hand-authored

Every statistic comes from a simulated play. No baseline generation, no
"plausible" numbers applied to unsimulated players, no synthetic league leaders.
If a player didn't play the snap, the snap didn't happen.

### Realism is measured against the real NFL

League-wide season totals and distributions should sit inside historical NFL
bands — passing yards per team, sack rates, completion percentages, rush yards
per carry, turnover rates, etc. A season where the league leader in rushing has
800 yards or 3,000 yards is a bug.

### Stats are the primary feedback loop for GM decisions

The GM cannot see true attributes. Stats are the strongest public signal
available and must be rich enough to drive real decisions — re-sign or walk,
extend or trade, start the rookie or the veteran.

### Stats accumulate across career and league history

Per-game, per-season, and career totals persist. League history retains season
leaders, records, and all-time lists. Retired players keep their stats; traded
players carry their stats.

## Scope

### Player statistics

- **Offense:** passing, rushing, receiving, offensive line (sacks allowed,
  pressures allowed, run-block grades where derivable from sim events).
- **Defense:** tackles, sacks, TFLs, pressures, interceptions, pass defenses,
  forced fumbles, coverage stats (targets, catches allowed, yards allowed).
- **Special teams:** kicking, punting, return stats, coverage tackles.
- **Availability:** games played, games started, snap counts by phase.

### Team statistics

- Offensive and defensive totals and per-game rates.
- Drive-level stats: points per drive, 3rd down %, red zone %, turnover
  differential.
- Situational splits: home/away, division, vs. winning teams, close-and-late.

### League statistics

- Season leaders and leaderboards per stat.
- All-time records (single-game, single-season, career).
- Standings with tiebreakers.
- Awards derived from stats (MVP, OPOY, DPOY, etc.) — stats are input, not sole
  determinant.

### Splits and context

- Game-by-game logs per player and per team.
- Home/away, month, opponent.
- Situational: down-and-distance, red zone, third down, two-minute.

## Sim requirements

- The game simulation must emit per-play events rich enough to derive every
  statistic above, regardless of sim mode. Both single-game (fast) and
  play-by-play modes produce the same event shape — no stat category is added
  after the fact via sampling, and no mode is allowed to skip categories.
- Per-play events include: participants, outcome, yardage, situation
  (down/distance/field position), and any position-specific event (sack,
  pressure, target, coverage assignment, etc.).
- League-wide tuning: after any sim change, league aggregates must be validated
  against historical NFL bands before merge.

## Out of scope (for now)

- Advanced analytics layered on top of base stats (EPA, DVOA-style metrics, win
  probability added). Base stats first; analytics later.
- Tracking data (route running charts, defender proximity, etc.).
- User-authored custom stat formulas.

## Interaction with other systems

- **[Player Attributes](./player-attributes.md):** stats are the observable
  surface; true attributes are hidden. Stats are filtered through scheme,
  coaching, teammates, and opponents.
- **[Coaches](./coaches.md):** team and unit stats are the primary report card
  for coaching staffs.
- **[Game Simulation](./game-simulation.md):** the sim is the source of truth;
  stats are its exhaust.
- **[Media](./media.md):** narratives, grades, and awards draw on stats but are
  not stats themselves.
- **[League Genesis](./league-genesis.md):** Year 1 of a genesis league runs a
  shorter regular season and no preseason, so stat distributions for the
  inaugural year will look different than Year 2+. The league's first
  statistical leaders are the first ever — every leaderboard entry in a genesis
  league's record book was written by a human or NPC operator at this table.
