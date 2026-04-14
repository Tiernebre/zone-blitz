# Game Simulation

The simulation engine is what happens on the field. You don't control it
directly — your influence comes from the roster you built, the coaches you
hired, and the scheme you set. The simulation resolves all of those decisions
into game outcomes.

## Design Philosophy

The sim needs to produce **believable, interesting, NFL-accurate results** that
reward good team-building decisions. A well-constructed roster with good scheme
fit and quality coaching should win more than it loses — but not always. Upsets
happen. Injuries happen. Bad bounces happen. That variance is what makes each
season unpredictable.

### NFL as the benchmark

The NFL is the reference, not arcade football. Every countable thing the sim
produces — plays per game, pass/run split, completion %, yards per carry,
sacks, tackles, turnovers, penalty counts, injury frequency — must sit inside
historical NFL bands. A 90-point shootout or a quarterback throwing for 700
yards is a bug, not a highlight. Stat realism is covered in
[Statistics](./statistics.md); this doc governs the event generation that
produces those stats.

Concrete expectations the sim must hit league-wide:

- ~125–135 offensive plays per game (both teams combined), split roughly
  55–60% pass / 40–45% rush in the modern era
- Completion % in the 60–70% band for starters; yards per attempt ~6.5–8.0
- Yards per carry ~4.0–4.7
- ~2.0–2.5 sacks per team per game; turnovers ~1.0–1.6 per team per game
- Tackle, target, and touch distributions that concentrate on starters the way
  they do in the NFL (RB1 carrying the load, WR1/WR2/TE taking the majority of
  targets, etc.)

These are guideposts, not hard caps — individual games vary wildly. But
league-season aggregates must land inside NFL historical ranges.

### Two supported simulation modes

The sim supports two first-class modes, both producing the same statistical
output shape so downstream systems don't care which was used:

**Single-game simulation (fast mode)**

- Resolves a full game in one pass without iterating play-by-play
- Derives plays, drives, and box-score stats from matchup models calibrated to
  NFL distributions
- Used for: non-user games in a week, deep sim (sim-to-end-of-season), league
  history backfill, what-if exploration
- Must still emit the per-play event stream (see
  [Statistics — Sim requirements](./statistics.md#sim-requirements)) so the
  same stat categories are populated; events can be generated in bulk rather
  than sequentially

**Play-by-play simulation**

- Iterates one play at a time with full situational context (down, distance,
  field position, score, clock, personnel, fatigue, momentum)
- Used for: the user's games, nationally-televised marquee matchups, playoff
  games, or any game the user opts into watching
- Supports live coaching decisions (4th-down calls, timeouts, challenges,
  personnel packages), in-game injuries with follow-on play effects, and
  readable game logs

Both modes share the same underlying player performance model, scheme matchup
logic, and coaching modifiers. A game simulated single-pass and the same game
simulated play-by-play should, over many trials, produce statistically
indistinguishable results. The difference is granularity and interactivity,
not outcome distribution.

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
- Any given Sunday — the worst team in the league can beat the best on the right
  day

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
struggle in the open field. Better players have great games more often — but any
given play depends on which attributes are relevant.

### Injuries

Injuries happen inside the simulation, not as a separate offseason bookkeeping
step. They are driven by per-play risk, modulated by player durability,
position, scheme, and game context. Both sim modes produce injuries: in
play-by-play they resolve on the specific play that caused them; in
single-game mode they are distributed across the game's event stream so box
scores, snap counts, and drive logs reflect when the player went down.

**NFL-realistic rates**

Injury frequency is calibrated to real NFL data, not gameplay feel. Target
bands the league-wide sim output must stay inside:

- ~1.5–2.5 new injuries per team per game across all severities, concentrated
  on high-contact positions (RB, WR, LB, DB, OL)
- Season-ending injury rate roughly 8–12% of active roster per team per season
- Soft-tissue injuries (hamstring, groin, calf) are the most common category;
  concussions, high-ankle sprains, and ACL/MCL tears follow in the
  distributions seen in league injury reports
- Position-specific risk profiles: RBs and slot WRs absorb the most contact,
  OL and DL accumulate chronic wear, QBs are protected by rules but
  devastating when hit, kickers/punters rarely get hurt
- Re-injury rates elevated for players returning early or with flagged
  durability

**Severity and in-game handling**

- Severity tiers: shake-it-off (back next play), miss drive, miss quarter,
  miss rest of game, miss weeks, miss season, career-ending
- Play-by-play mode: the injured player exits, depth chart promotes the next
  man up, and subsequent plays reflect the replacement's attributes — a
  backup LT facing an elite edge rusher is a real problem for the rest of the
  game
- Single-game mode: injury timing still matters for snap counts and stat
  accrual — an RB1 who tears his ACL on the first drive should not finish
  with a full workload
- Post-game: injury report feeds into the weekly availability system,
  practice participation, and long-term roster planning

**Why this matters for gameplay**

Injuries are not a punishment mechanic, they are a realism constraint that
forces the roster-building loop to value depth, durability, and medical staff
investment. A team that only drafts for starters and ignores the back half of
the roster should get punished by the same attrition rates that punish real
NFL GMs.

## Season-Level Simulation

### Player progression and regression

Player development and decline are driven by the attribute system — see
[Player Attributes: Progression and Regression](./player-attributes.md#progression-and-regression)
for the full model. The key dynamics at season level:

### Mid-season coaching changes

Firing a coach mid-season has immediate consequences on game simulation — this
isn't a clean offseason transition. See [Coaches](./coaches.md) for the full
system; the key sim-level effects:

- **Scheme fit disruption** — players lose their scheme fit alignment
  immediately; the new coach's tendencies demand different attributes, and
  players haven't had time to adjust. Expect a performance dip in the weeks
  following a coaching change, especially if the new scheme is fundamentally
  different from the old one.
- **Staff disruption** — a fired HC often means coordinators and position
  coaches leave too (see [Coaches — Firing Consequences](./coaches.md)). Interim
  or hastily-hired replacements are typically less effective than established
  staff, further depressing game-day performance.
- **Morale impact** — players loyal to the fired coach may see morale dip,
  affecting effort and consistency. Other players may get a motivational boost
  from the change. The net effect depends on the locker room dynamics.
- **New coach learning curve** — a mid-season hire starts from scratch
  evaluating the roster. His initial depth chart decisions may be wrong, and his
  game-planning against opponents he hasn't studied is less effective. This
  improves week over week but costs games early.
- **Scheme transition timeline** — young players adapt faster than veterans (see
  [Schemes & Strategy — Scheme Transitions](./schemes-and-strategy.md)). A
  mid-season change doesn't allow a full installation — the new coach runs a
  simplified version of his system until the offseason.

The sim should reflect that mid-season coaching changes are disruptive in the
short term, even when they're the right long-term decision. A team that fires
its coach in week 8 and immediately starts winning is the exception, not the
rule.

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

## Live Broadcast Experience

When the user chooses to watch a game, play-by-play simulation feeds a **live
interactive broadcast UI** — the "I'm watching this game" experience, not
just a box score that ticks forward. Think ESPN/NFL Sunday Ticket's on-field
overlays and Next Gen Stats, but with the full simulation state available
because the game is happening inside our own engine. Nothing is inferred from
TV cameras; every player's position, assignment, and attribute contribution
is known exactly.

### What the user sees

- **The field** — a top-down (or adjustable angle) football field rendered in
  the browser with both teams' 22 players in their pre-snap alignment.
  Formation, motion, personnel package, and defensive front are all visible.
  The ball, line of scrimmage, first-down marker, and hash are drawn.
- **The play, as it happens** — once the ball is snapped, player icons move
  according to the simulated play: routes run, blocks engaged, rush lanes,
  coverage drops, tackles made. Speed, acceleration, and separation reflect
  the underlying attribute values, so a 4.3 WR visibly pulls away from a 4.6
  CB. The play can be paused, rewound, and replayed.
- **Drive context panel** — current drive summary (plays, yards, time of
  possession), down/distance, field position, score, quarter, clock,
  timeouts, win probability. Updates in real time as plays resolve.
- **Broadcast-style overlays** — pre-snap: defensive front recognition,
  offensive personnel grouping, suggested matchups to watch, historical
  tendencies for this down/distance. Post-snap: yards gained, ball carrier
  top speed, separation at the catch point, pressure time, missed-tackle
  count, pass velocity, air yards vs. YAC.
- **Player spotlight** — click any player on the field to see their live
  stat line for the game, key attributes relevant to the current play type,
  scheme fit, fatigue, and any in-game injury flags. A WR spotlight shows
  targets, catches, yards, drops, separation per target.
- **Drive chart** — a running ledger of every play in the current drive with
  expandable detail. Completed drives collapse into a per-drive summary
  (start field position, plays, yards, result) and remain scrollable for the
  whole game.
- **Coaching seat** — the user, as GM, generally watches rather than
  coaches; but when their team is on the field they can override key
  decisions their HC would otherwise make (4th-down go-for-it, timeout,
  challenge, two-point try, field-goal attempt). These decisions feed back
  into the play-by-play engine before the next play resolves.

### Why this depth is possible here and not on TV

Real broadcasts guess at coverage, player intent, and matchup edges from
camera angles and charting. We don't have to guess — the simulation is
authoritative. Every live overlay (pressure time, separation, coverage
assignment, tendency-break, scheme-fit advantage) is a direct readout of
the same per-play event stream described in
[Statistics — Sim requirements](./statistics.md#sim-requirements). That
means the live UI and the post-game stat sheet are never inconsistent, and
every advanced readout is traceable to a deterministic source, not a
broadcaster's best guess.

### Consistency with non-watched games

The broadcast UI is a presentation layer on top of play-by-play mode.
Whether a game is watched or single-game-simulated, it writes the same
events to the same stat surface. A user who checks a box score later for a
game they didn't watch sees results that match what *would have been*
displayed live, pulled from the same event records. No divergence, no
"broadcast mode" with different numbers.

### Out of scope for the initial broadcast UI

- Multiple camera angles, cinematic replays, or animated player models
  (icons and motion paths are enough).
- Commentary audio or generated play-by-play narration (text feed only at
  first — see [Media](./media.md) for narrative layering later).
- VR / 3D stadium rendering.
- User-controllable camera during live plays beyond play-by-play pause and
  replay.

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
