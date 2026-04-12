# Game Simulation

The simulation engine is what happens on the field. You don't control it
directly — your influence comes from the roster you built, the coaches you
hired, and the scheme you set. The simulation resolves all of those decisions
into game outcomes.

## Design Philosophy

The sim doesn't need to be a play-by-play action game. It needs to produce
**believable, interesting results** that reward good team-building decisions.
A well-constructed roster with good scheme fit and quality coaching should
win more than it loses — but not always. Upsets happen. Injuries happen. Bad
bounces happen. That variance is what makes each season unpredictable.

### Fidelity Spectrum

The simulation can operate at different levels of fidelity:

**Box score level (MVP / starting point)**
- Produces a final score and key stats (passing yards, rushing yards,
  turnovers, etc.)
- Scheme matchups, personnel quality, and coaching modifiers determine
  outcomes
- Fast to compute, easy to validate

**Drive-level simulation**
- Each game is a series of drives with outcomes (touchdown, field goal, punt,
  turnover)
- More granular stats and a sense of game flow
- Enables comeback narratives, clock management, momentum swings

**Play-by-play simulation (aspirational)**
- Individual play outcomes
- Full box scores with realistic stat distributions
- Game logs you can read through
- Enables detailed coaching strategy (4th-down decisions, clock management,
  play-calling tendencies)

Start at box score level. Layer in drive-level when the core game loop is
proven. Play-by-play is an ambitious long-term goal.

## What the Sim Must Get Right

### Talent matters most

The team with better players should win more often. This is the baseline. If
scheme and coaching matter but talent doesn't, roster-building (the core
gameplay) becomes meaningless.

### Scheme matters second

Scheme advantages create edges but don't override talent gaps:

- A spread offense with four WRs against a base 4-3 that refuses to go nickel
  creates mismatches
- A power run team in bad weather against a finesse defense has an edge
- A zone blitz rattles a young QB but a veteran reads it and audibles

### Coaching matters third

Good coaches squeeze more out of their personnel:

- Halftime adjustments from great coordinators can swing a game
- Good game-planning exploits opponent weaknesses
- Bad coaches make questionable decisions in close games (going for it on 4th
  down at the wrong time, poor clock management)

### Variance keeps it interesting

Even a dominant team should lose occasionally:

- Turnovers are high-variance
- Injuries during games can change outcomes
- Any given Sunday — the worst team in the league can beat the best on the
  right day

### Positional importance reflects real football

Quarterback is the most important position. This isn't a design choice — it's
reflecting reality. A great QB elevates the whole team. A bad QB drags it down.
But a great QB behind a terrible offensive line still struggles. Positional
interdependence matters.

## Player Performance Model

Player attributes are the engine of the simulation. For the full attribute
system — the 0-100 scale, attribute categories, hidden potential, and
progression/regression — see [Player Attributes](./player-attributes.md).

### Game-day performance

The simulation consumes individual attributes — never an aggregate overall
rating. On every play, the relevant attributes for each player in that context
determine the outcome:

```
Relevant attributes for the play context
  + Scheme fit modifier (derived from attribute alignment with scheme)
  + Coaching modifier (see Coaches)
  + Matchup modifier (vs. specific opponent's attributes)
  + Game context (weather, home/away, rivalry, playoff pressure)
  + Random variance
  = Play outcome contribution
```

This means the same player can dominate in one context and disappear in another.
A power back with elite strength and poor speed will thrive in short yardage and
struggle in the open field. Better players have great games more often — but
any given play depends on which attributes are relevant.

### Injuries

- Injuries occur during games based on durability, position risk, and
  randomness
- Severity ranges from missing a play to season-ending
- Injury-prone players get hurt more often
- Playing a not-fully-recovered player risks re-injury
- Injuries create roster crises that test depth and cap management

## Season-Level Simulation

### Player progression and regression

Player development and decline are driven by the attribute system — see
[Player Attributes: Progression and Regression](./player-attributes.md#progression-and-regression)
for the full model. The key dynamics at season level:

### Retirement

- Players retire based on age, performance decline, and personality
- Some players retire early (injury concerns, personal reasons)
- Stars may hold on too long, declining in their final years
- Retirement creates roster holes and cap relief

### Award races

Stats and team success drive award voting:

- MVP, Offensive/Defensive Player of the Year
- Rookie of the Year
- All-Pro teams
- Pro Bowl selections
- These affect player contract demands and conditional trade pick resolutions

## What the Sim Produces

For each game, at minimum:

- Final score
- Team stats (total yards, rushing yards, passing yards, turnovers, time of
  possession, third-down conversion rate)
- Individual player stats (QB: completions/attempts/yards/TDs/INTs, RB:
  carries/yards/TDs, WR: receptions/yards/TDs, DEF: tackles/sacks/INTs)
- Key moments (if drive-level or above): go-ahead touchdowns, critical
  turnovers, game-winning drives
- Injury report: who got hurt and how long they're out

For the season:

- Standings and playoff picture
- Statistical leaders
- Power rankings (algorithmic, team strength estimate)
- Strength of schedule impact
