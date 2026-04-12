# Player Attributes

Player attributes are the ground truth of every player in the simulation. They
are the hidden engine behind every game outcome, every stat line, every breakout
season, and every puzzling decline. But they are **never directly visible** to
the user. You experience attributes only through the filtered, biased,
incomplete lens of your coaches and scouts.

## Design Philosophy

### A true 0-100 scale

Most sports games treat 0-100 as a 50-100 scale in disguise. A "50 overall"
player is the worst player in the game — which raises the question: what are
0-49 for? This game uses the full range, and every number means something.

The scale is calibrated to professional football:

| Range | What it means | Real-world example |
|-------|---------------|--------------------|
| 95-100 | Generational. One per decade at a position, maybe. | Peak Tom Brady, Joe Montana, Walter Payton |
| 85-94 | Elite. Perennial All-Pro, franchise-defining. | Patrick Mahomes, prime Aaron Donald |
| 70-84 | Franchise-caliber starter. The guy you build around. | Josh Allen, Lamar Jackson |
| 60-69 | Solid starter. Winning football, not losing you games. | Kirk Cousins, Derek Carr |
| **50-59** | **The Mendoza line. You can start, but nobody's excited.** | **Geno Smith** |
| 40-49 | Fringe starter / quality backup. Fills in without disaster. | Veteran bridge QB, journeyman guard |
| 25-39 | Backup / roster depth. Contributes on special teams. | Typical QB2, rotational defensive end |
| 15-24 | Practice squad. Developing or hanging on. | UDFA fighting for a roster spot |
| 1-14 | Shouldn't be on a professional football field. | Guy off the street |
| 0 | Horrendous. Cannot perform this skill at a professional level. | A punter trying to play linebacker |

**50 is the line.** Above it, you're a starter somewhere in this league. Below
it, you're fighting for your job. The further above 50, the harder you are to
replace. The further below, the more your team is hoping the guy behind you
develops.

### Bell curve distribution

Attributes across the league follow a natural bell curve, peaking around
**35-40**. This means the average player on a roster is a backup — which
reflects reality. Most roster spots are depth, not starters.

The distribution is **right-skewed with a steep dropoff at the elite end**:

- The bulk of the league clusters between 25-55
- Genuine starters (50+) are the minority of total players
- Quality starters (60+) are noticeably uncommon
- Franchise players (70+) are rare — maybe 2-3 per team at most
- Elite players (85+) are extraordinarily rare — 5-10 across the entire league
- Generational players (95+) may not exist in any given season. When one does
  exist, it's an event. There might be one per decade at a position.

This means finding a 70+ player in the draft is a major win. Finding an 85+ is
a franchise-altering event. And if you somehow land a 95+, you've found a
player who will be discussed for decades.

### No overall rating

There is no OVR. Not for the user, and not under the hood. The simulation
doesn't care about a single number — it cares about specific attributes in
specific contexts. A quarterback's arm strength matters on a deep out route.
His pocket awareness matters under pressure. His speed matters on a bootleg.
Reducing a player to one number would erase the very thing that makes
evaluation interesting.

What users see instead:

- **Coaches assess players through the depth chart.** Your coaching staff ranks
  players at each position — "he's our starter, he's the backup." This
  reflects the coaches' evaluation, filtered through their own biases and
  scheme preferences. A coach who values arm strength might bench a smart,
  accurate QB in favor of a cannon-armed gunslinger. You'll figure that out
  when the gunslinger throws three interceptions.
- **Statistics tell the story after the fact.** Yards, touchdowns, completion
  percentage, tackles, sacks — the numbers paint a picture of how a player
  actually performed. If your coaches have a guy starting and his stats are
  terrible, either the coaches are wrong about him or the scheme doesn't fit
  him. You decide.
- **Scouting reports provide pre-acquisition assessments.** Before you draft or
  sign a player, your scouts give you their read — filtered through their own
  accuracy and biases (see [Scouting](./scouting.md)).

The depth chart is your coaches' answer to "who's the best?" The box score is
reality's answer. The gap between the two is where you, the GM, earn your keep.

---

## Attribute Categories

Every player has attributes across three categories: **Physical**, **Technical**,
and **Mental**. Each attribute is an independent value on the 0-100 scale.
Attributes are position-agnostic in structure but position-specific in
relevance — every player has an arm strength rating, but it only matters for
quarterbacks.

### Physical attributes

Physical attributes represent a player's raw athletic traits. These are the
most genetically constrained — a player's physical ceiling is largely set at
birth. Physical attributes are also the most vulnerable to age-related decline.

- **Speed** — straight-line top-end speed
- **Acceleration** — how quickly the player reaches top speed; burst off the
  line
- **Agility** — change of direction, lateral movement, ability to cut
- **Strength** — raw power; ability to move or anchor against opponents
- **Jumping** — vertical leap and timing; relevant for contested catches,
  blocks, and deflections
- **Stamina** — endurance over the course of a game; resistance to fatigue
- **Durability** — resistance to injury; ability to absorb hits and stay healthy
- **Size** — not a 0-100 skill, but a physical trait that interacts with other
  attributes (a 95-speed player at 240 lbs is different from a 95-speed player
  at 185 lbs); represented as height and weight

### Technical attributes

Technical attributes represent learned skills — technique, craft, and
proficiency at specific football tasks. These are the most improvable through
coaching, repetition, and experience. A player with average physical tools but
elite technique can outperform a raw athlete who never develops his craft.

**Passing:**
- **Arm strength** — how far and how hard the ball can be thrown
- **Accuracy (short)** — precision on throws within 15 yards
- **Accuracy (medium)** — precision on throws between 15-30 yards
- **Accuracy (deep)** — precision on throws beyond 30 yards
- **Accuracy (on the run)** — precision while scrambling or rolling out
- **Touch** — ability to put arc and placement on the ball; lobs, back-shoulder
  throws, bucket throws over linebackers
- **Release** — quickness of the throwing motion

**Rushing / receiving:**
- **Ball carrying** — securing the ball, protecting it in traffic
- **Elusiveness** — making defenders miss in the open field; juke moves, spins,
  stiff arms
- **Route running** — precision of routes, ability to create separation through
  technique rather than pure speed
- **Catching** — hands, ability to secure the ball cleanly
- **Contested catching** — ability to win 50/50 balls; high-pointing, body
  positioning
- **Run after catch** — ability to gain yards after the reception

**Blocking:**
- **Pass blocking** — technique and ability in pass protection; anchor, hand
  placement, footwork
- **Run blocking** — technique and ability in run blocking; drive blocking,
  pulling, combo blocks
- **Block shedding** — ability to disengage from blocks as a defender

**Defense:**
- **Tackling** — technique and reliability when making tackles
- **Man coverage** — ability to cover a receiver one-on-one; mirroring, hip
  fluidity, recovery
- **Zone coverage** — ability to read routes and defend zones; positioning,
  awareness of receivers entering the zone
- **Pass rushing** — technique for getting to the quarterback; moves, counters,
  bend
- **Run defense** — ability to set the edge, fill gaps, play assignment-sound
  run defense

**Special teams:**
- **Kicking power** — leg strength for field goals and kickoffs
- **Kicking accuracy** — precision on field goal attempts
- **Punting power** — leg strength for punts; distance and hang time
- **Punting accuracy** — directional punting; ability to pin opponents deep
- **Snap accuracy** — precision and speed of long snaps

### Mental attributes

Mental attributes represent a player's cognitive and psychological makeup.
These are the hardest to evaluate through scouting and the most likely to
surprise you — positively or negatively — once a player is on your roster.

- **Football IQ** — understanding of the game; ability to read defenses/offenses
  pre-snap, make adjustments, understand complex schemes
- **Decision-making** — choosing the right option under pressure; knowing when
  to throw it away, when to take the sack, when to force a throw
- **Anticipation** — reading plays before they develop; throwing to where the
  receiver will be, jumping a route for an interception
- **Composure** — performance under pressure; clutch moments, hostile
  environments, playoff intensity; resistance to rattling
- **Consistency** — how much variance there is game-to-game; a consistent
  player's floor is close to his ceiling; an inconsistent player has brilliant
  games and terrible ones
- **Work ethic** — hidden drive to improve; affects development rate and how
  much a player grows between seasons
- **Coachability** — willingness and ability to learn from coaching;
  receptiveness to scheme changes and technique adjustments
- **Leadership** — impact on teammates' performance and morale; locker room
  presence

---

## Positional Relevance

Every player carries every attribute, but the simulation weights them by
position. Arm strength matters for a quarterback; it's irrelevant for a
cornerback. The full attribute list per position isn't a design document —
it's a simulation tuning exercise — but the principle is:

- **Each position has 5-8 primary attributes** that heavily influence
  performance in that role
- **Secondary attributes** provide marginal benefits (a fast offensive lineman
  is nice, but technique matters far more)
- **Irrelevant attributes** exist on every player but are ignored by the sim
  for that position

This means a player can have wildly different value depending on position. A
safety with elite man coverage (75) but poor zone coverage (40) is a liability
in a Cover-2 scheme but could thrive in a man-heavy defense. The attributes
don't change — the context does.

---

## Hidden Potential

Every player has a **hidden potential ceiling** for each attribute. This is
the maximum value that attribute can ever reach through development. Potential
is set when a player is generated and never changes.

### How potential works

- Potential is **per-attribute**, not a single number. A wide receiver might
  have a route running ceiling of 85 but a catching ceiling of only 60. He'll
  become a great route runner who drops too many passes — a specific, realistic
  player archetype.
- Potential is **completely hidden**. No scout, coach, or analytic tool can see
  it. You only discover it by watching what happens when a player gets
  opportunities and coaching.
- A player's **current attribute value** can be well below his potential. A
  rookie WR with 40 route running and 80 potential in that attribute has room
  to grow into a quality route runner — but only if he gets reps, good
  coaching, and time.
- A player whose current value already equals his potential in an attribute
  has **maxed out** that skill. No amount of coaching will improve it further.
  He is what he is.

### The boom-or-bust dynamic

Hidden potential is what creates the most exciting moments in the game:

- **The late-round steal**: A player drafted in the 5th round has low current
  attributes but sky-high hidden potential. He sits behind the starter for two
  years, developing quietly. When the starter gets hurt, the backup steps in
  and plays like a Pro Bowler. His potential was always there — he just needed
  the opportunity and development time.
- **The overdraft bust**: A player taken in the 1st round has high current
  attributes but low hidden potential. He looks great as a rookie because his
  skills are already near their ceiling. But he never improves. By year 3,
  mid-round picks have developed past him. His floor was his ceiling.
- **The unexpected breakout**: A player whose potential is high but whose
  development has been slow suddenly clicks — a new coaching staff, a scheme
  change, or just natural maturation. His attributes jump in a single
  offseason. These are rare but unforgettable.
- **The tragic decline**: A player whose physical potential ceiling is high but
  whose durability is low. Injuries erode his physical attributes below even
  his current level. The talent was there; the body betrayed him.

### Why coaches can't see potential

Coaches evaluate players based on what they can observe — current performance,
practice habits, and game tape. A coach might say "this kid has a high motor
and I think he can develop" — but that's the coach's imperfect read on the
player's work ethic and coachability, not a direct view of hidden potential.

A great coaching staff will develop players faster and closer to their ceilings.
But even the best coaches can't make a player exceed his genetic limits on
speed, or push a player's route running past a ceiling the coach doesn't know
exists.

This means player development is a bet you make with incomplete information —
exactly like every other decision in this game.

---

## Progression and Regression

Attributes change over time. Players aren't static — they grow, peak, and
decline. How and when this happens depends on the attribute category.

### Physical attributes

Physical attributes are **genetically constrained and age-sensitive**:

- Physical attributes have hard ceilings set by hidden potential (genetics)
- Young players may still be growing into their physical tools (a 21-year-old
  might gain a point or two of speed as his body matures)
- Physical attributes **peak early** (mid-20s for most, earlier for
  speed-dependent traits) and **decline with age**
- The decline is **position-dependent**: running backs lose speed earlier than
  quarterbacks lose arm strength
- Decline is **not linear** — a player might hold steady for years and then
  drop off sharply, or erode gradually
- Injuries can permanently reduce physical attributes below a player's
  age-adjusted level; a torn ACL might take 3 points off speed permanently
- Physical attributes **cannot be coached up** beyond genetic ceiling — no
  amount of training makes a 4.6 runner into a 4.3 runner

### Technical attributes

Technical attributes are **the most improvable** and represent the primary
axis of player development:

- Improvement depends on: coaching quality, scheme stability, playing time
  (reps), work ethic, and coachability
- A player in a stable scheme with a great position coach develops faster than
  one bouncing between systems with a mediocre coach
- Technical development **continues through a player's prime** — a 30-year-old
  QB can still improve his accuracy if his mental processing and technique
  continue to sharpen
- Technical attributes decline later than physical ones, and more gradually —
  a veteran's technique often compensates for physical erosion
- Scheme changes can effectively "reset" some technical development — a zone
  blocking guard moving to a power scheme may regress in run blocking
  temporarily as he learns new techniques

### Mental attributes

Mental attributes follow their own trajectory:

- **Football IQ** tends to increase with experience — veterans read the game
  better than rookies
- **Decision-making** improves with reps and game experience but has a ceiling
  tied to the player's natural cognitive ability
- **Composure** can improve (players get used to pressure) or decline (a
  player who's been benched or booed might lose confidence)
- **Consistency** is relatively stable but can shift — a player who cleans up
  his lifestyle might become more consistent; one dealing with off-field
  issues might become less so
- **Work ethic** and **coachability** are mostly stable personality traits but
  can shift in response to major events (new coaching staff, contract year,
  personal maturation)
- **Leadership** develops over time — few rookies are leaders; veterans often
  grow into the role

### Development rate

How fast a player develops is influenced by:

- **Hidden potential** — a player can't develop past his ceiling, so a player
  near his ceiling develops slowly (there's nowhere to go)
- **Work ethic** — high work ethic accelerates development
- **Coachability** — coachable players absorb coaching faster
- **Coaching quality** — better coaches develop players faster (see
  [Coaches](./coaches.md))
- **Playing time** — players who play develop faster than those who sit; but
  throwing a raw player into the fire before he's ready can damage confidence
  (composure hit)
- **Scheme stability** — players in the same scheme year after year develop
  technical skills faster than those learning a new system annually
- **Age** — younger players develop faster; development rate slows with age

### The opportunity question

This is where hidden potential creates its most compelling stories. A backup
with enormous hidden potential sits behind an established starter. His
attributes develop slowly because he's not getting game reps — just practice.
Then the starter gets hurt.

The backup steps in and performs well — not because he magically got better
overnight, but because:

1. His practice reps have been slowly developing his technical skills
2. His hidden potential means he has room to grow that the starter didn't
3. Game reps now accelerate his development
4. The coaching staff — and you — had no idea he was this close to being good

This is the Tom Brady story. The Kurt Warner story. The story this attribute
system is built to produce organically, without scripting it. The talent was
always there. It just needed the opportunity to emerge.

---

## Interaction with Other Systems

### Scouting

Scouts evaluate attributes, but they never see the true values. A scout's
report is his best guess at a player's current skill, filtered through his
own accuracy, biases, and the depth of his evaluation. See
[Scouting](./scouting.md) for how this works.

Key interactions:

- Scouts assess **current attributes** (with noise and bias)
- Scouts **cannot see hidden potential** — they can guess at "ceiling" based on
  physical tools and age, but it's a guess
- Mental attributes are the **hardest to scout** — a few interviews and film
  sessions aren't enough to truly know a player's football IQ or composure
- Physical attributes are the **easiest to scout** — combine numbers and film
  give a relatively clear picture

### Coaches

Coaches interact with attributes in two ways: they **evaluate** players (depth
chart decisions, scheme fit assessments) and they **develop** players (coaching
up technical skills, managing confidence). Coaches have their own biases and
accuracy — a coach who overvalues speed might start a fast but raw player over
a polished but slow one. See [Coaches](./coaches.md) for the full coaching
system.

### Game simulation

The simulation engine consumes individual attributes — never an aggregate
overall rating. On every play, the relevant attributes for each player in that
context are what determine the outcome. A quarterback's deep accuracy matters
on a go route. His composure matters when the pocket collapses. His football
IQ matters when reading a disguised coverage.

This means a player can be dominant in one context and mediocre in another —
which is exactly how real football works. A power back with 85 strength and
45 speed will dominate short-yardage situations and disappear in the open
field. The attributes are the truth. The context determines which truth matters.

### Contracts and market value

A player's **perceived value** — what he can command on the market — is based
on what's visible: statistics, awards, reputation, and age. Not on hidden
attributes. This creates market inefficiencies:

- A player whose stats are inflated by scheme may be overvalued
- A player with elite hidden attributes who hasn't had opportunity may be
  undervalued
- An aging player whose physical decline hasn't shown up in the stats yet may
  be overvalued
- A young player whose technical development is about to take off may be
  undervalued

Exploiting these inefficiencies is a core GM skill.
