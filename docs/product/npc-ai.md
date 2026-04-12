# NPC AI

NPC teams make or break a franchise sim. In single-player, they ARE the game —
every team you're not controlling needs to feel like it's run by a real person
with opinions, biases, and a plan. In multiplayer, NPC teams fill out the
league and must be competent enough that human GMs can't exploit them but
interesting enough to create storylines.

## Design Philosophy

NPC teams shouldn't feel like slot machines filling roster spots. They should
feel like **rival GMs with opinions you disagree with**.

"The Bears just traded up to grab the QB I was targeting." "Why did the Dolphins
let their best CB walk in free agency?" "The Raiders are running an air raid
offense with a roster built for power run — what is their GM thinking?" These
reactions only happen when the AI has legible, distinct decision-making.

## AI Personality System

Every NPC GM has a personality profile built from tunable axes. These aren't
cosmetic labels — they drive every decision the AI makes.

### Personality Axes

**Risk tolerance**
- Low: conservative, avoids boom-or-bust moves, prefers safe picks
- High: trades up aggressively, gambles on upside, willing to mortgage the
  future for a shot at a title

**Time horizon**
- Short: builds for this year, values veterans, impatient with losing
- Long: builds for 3 years out, values youth and draft capital, tolerates
  losing seasons as part of a plan

**Positional value bias**
- Every GM has positions they value more or less than market consensus
- Some believe in paying running backs; others never will
- Some prioritize OL investment; others believe in skill positions first
- These biases show up in drafting, free agency, and trade evaluation

**Analytics trust**
- High: values measurables, combine data, and efficiency metrics
- Low: values game tape, intangibles, and "eye test"
- Affects scouting emphasis and how they evaluate players

**Scheme loyalty**
- High: forces players into the scheme, will tear down a roster to fit a
  new coaching hire's system
- Low: adapts the scheme to fit available personnel, pragmatic about playstyle

**Aggressiveness in transactions**
- How often they initiate trades vs. wait for offers
- How aggressively they bid in free agency
- How willing they are to make blockbuster moves

### Archetype Examples

Archetypes are starting templates — individual GMs may blend traits from
multiple archetypes.

**"The Moneyball GM"**
Analytics-driven. Exploits market inefficiencies. Avoids overpaying free agents.
Targets undervalued positions and contract situations. Lets expensive veterans
walk and collects compensatory picks. Wins through process, not splash moves.

**"Win Now"**
Trades future picks aggressively for proven talent. Signs the biggest free
agents. Impatient with rebuilds. If the team is 6-4, they're buying at the
deadline. If they're 3-7, they might panic-fire the coach. High risk, high
reward — sometimes builds a dynasty, sometimes creates cap hell.

**"The Developer"**
Prioritizes draft picks and player development. Patient, multi-year plans.
Rarely makes blockbuster trades. Prefers to re-sign homegrown talent. Builds
through the draft, develops players, wins when the talent matures. The roster
moves slowly but steadily.

**"Old School"**
Values size, toughness, and running the ball. Skeptical of analytics and spread
offenses. Overpays for "football players" — big linemen, physical backs, tough
linebackers. Dismissive of smaller, faster players regardless of production.
Hires coaches who share the philosophy.

**"The Gambler"**
High risk tolerance, loves trades, always in motion. Will trade three firsts
to move up for "their guy." Makes splashy free agent signings. The roster is
always in flux. Exciting to watch, inconsistent results.

## Front Office Decision-Making

### Drafting

NPC GMs build draft boards based on their personality:

- **BPA vs. need**: Analytics GMs lean BPA. Old School GMs draft for need
  earlier. Win Now GMs reach for "impact" positions.
- **Scheme filtering**: GMs filter the board through their scheme. A 3-4 team
  ranks 3-4 OLBs differently than a 4-3 team.
- **Risk tolerance**: Conservative GMs avoid "red flag" prospects (character
  concerns, injury history). Gamblers embrace upside.
- **Positional bias**: Shows up in where they draft positions relative to
  consensus. A GM who believes in paying RBs early will draft one in the 1st.

### Trading

See [Trading](./trading.md) for full NPC trade behavior. Key points:

- NPCs initiate trades, not just respond to offers
- NPCs trade with each other — the league has activity you didn't cause
- Personality drives trade behavior (buy/sell tendencies, deadline behavior)
- The AI is a tough but fair negotiator

### Free Agency

See [Free Agency & Contracts](./free-agency-and-contracts.md) for full NPC
behavior. Key points:

- Spending philosophy varies by personality
- NPCs compete with each other and with you for players
- The market feels alive

### Coaching Hires

When a coaching position opens, the NPC GM:

- Identifies candidates with scheme expertise they prefer
- Weighs experience vs. upside (analytics GMs may hire an unproven
  coordinator; old school GMs want a veteran head coach)
- Coaching hires shape the team's identity for years — this is a
  consequential NPC decision

### Roster Construction

Day-to-day decisions:

- Depth chart management based on scheme and performance
- Practice squad decisions — who to stash, who to cut
- IR decisions — shut down an injured player for the season or hope for a
  quick return?
- 53-man roster cuts — painful decisions with cap implications

### Rebuild vs. Contend

NPCs should recognize their competitive window:

- A team that starts 1-6 with an aging roster should become a seller at the
  deadline
- A team with a young QB on a rookie deal and cap space should be aggressive
- These state transitions should happen organically based on the AI's
  assessment of their roster, not a hard-coded trigger

## Coaching AI

Separate from the front office, coaching AI handles:

### Scheme Selection

- Coaches have scheme expertise (a coordinator specializes in certain systems)
- The coaching staff selects schemes based on their expertise and the available
  personnel
- A great coach adapts to their roster; a stubborn coach forces their system
- Coaching staff and GM may conflict — a run-first coach on a team the GM
  built around passing creates tension (and a realistic dynamic)

### Game Planning

- Coordinators game-plan for opponents based on matchups
- Halftime adjustments — good coaches adjust; bad coaches are stubborn
- Weather and game context affect play-calling (more conservative with a lead,
  more aggressive when trailing)

### Player Development

- Coaches influence player development rates
- A great QB coach accelerates a young QB's growth
- Scheme familiarity affects development — a player in the same system for
  years develops faster than one in a new system
- Development focus — coaches prioritize developing certain players based on
  the team's needs

## What Makes Good NPC AI

The best NPC AI creates **stories**:

- The rival GM who always seems to draft the player you wanted
- The perennial contender that finally collapses when their QB retires and
  they're in cap hell from years of aggressive spending
- The rebuilding team that suddenly trades up for a franchise QB and
  becomes the next dynasty
- The old school GM who refuses to adapt to the modern game and slowly falls
  behind
- The trade deadline frenzy where three NPC teams are all bidding for the
  same rental player

These narratives emerge from consistent, personality-driven decision-making —
not from scripted events. The AI doesn't need to be "smart" in an optimal
sense. It needs to be **coherent** — making decisions that follow logically
from its personality and situation, even if those decisions are sometimes wrong.
