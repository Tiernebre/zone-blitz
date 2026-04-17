# Player Attributes

Player attributes are the ground truth of every player in the simulation. They
are the hidden engine behind every game outcome, every stat line, every breakout
season, and every puzzling decline. But they are **never directly visible** to
the user. You experience attributes only through the filtered, biased,
incomplete lens of your coaches and scouts.

## Design Philosophy

### Attributes are normalized to _this_ league

The first thing to understand about Zone Blitz attributes: the scale is
**league-local**, not an external measurement against real-world professional
football. A 95 in your league is the best in your league, period — not a
guarantee that the player would be a 95 in the NFL or any other reference
league.

In particular: a young [newly set-up league](./league-setup.md) draws from a
initial player pool that is genuinely more modest than the NFL's talent
population — raw college athletes, practice-squad journeymen, back-end vets,
middling pros looking for a new shot. The league normalizes attributes across
that pool anyway, because that's the talent the league actually has. The
league's top quarterback in Year 1 rates as a top quarterback, full stop.
Whether he would have started in the NFL is not a question this game needs to
answer — and, realistically, a 90+ player in a young Zone Blitz league is
probably closer to an NFL starter than an NFL superstar in absolute terms.

This matters because:

- **The scale floats with the league's talent level.** A league that has
  accumulated twenty years of generational rookies has a different effective
  ceiling than a Year 1 league — even though both use the same 0-100 range.
- **Comparisons across saves are meaningless.** The 95 QB in your current save
  is not directly comparable to the 95 QB in your friend's save. Each league's
  attributes reflect that league's talent distribution.
- **Stars are stars within their league.** The simulation, media, awards, and
  record book all treat league-top attributes as the top. The league doesn't
  hedge its own superlatives against external reality.
- **As the league matures, the ceiling rises.** Later-generation draftees,
  coached by the league's accumulated knowledge, pass on improved development to
  the generation after them. The absolute level of the league's best players
  grows over decades of simulated play.

The real-world references below are **illustrative scale anchors, not literal
equivalences.** They help calibrate the feel of each tier, not promise that an
85 in your league would actually be Patrick Mahomes in ours.

### A true 0-100 scale

Most sports games treat 0-100 as a 50-100 scale in disguise. A "50 overall"
player is the worst player in the game — which raises the question: what are
0-49 for? This game uses the full range, and every number means something.

The scale is calibrated to professional football within the current league:

| Range     | What it means                                                     | Scale anchor (illustrative only)           |
| --------- | ----------------------------------------------------------------- | ------------------------------------------ |
| 95-100    | Generational. One per decade at a position, maybe.                | Peak Tom Brady, Joe Montana, Walter Payton |
| 85-94     | Elite. Perennial All-Pro, franchise-defining.                     | Patrick Mahomes, prime Aaron Donald        |
| 70-84     | Franchise-caliber starter. The guy you build around.              | Josh Allen, Lamar Jackson                  |
| 60-69     | Solid starter. Winning football, not losing you games.            | Kirk Cousins, Derek Carr                   |
| **50-59** | **The starter/backup line. You can start, but nobody's excited.** | **Geno Smith**\*                           |
| 40-49     | Fringe starter / quality backup. Fills in without disaster.       | Veteran bridge QB, journeyman guard        |
| 25-39     | Backup / roster depth. Contributes on special teams.              | Typical QB2, rotational defensive end      |
| 15-24     | Practice squad. Developing or hanging on.                         | UDFA fighting for a roster spot            |
| 1-14      | Shouldn't be on a professional football field.                    | Guy off the street                         |
| 0         | Horrendous. Cannot perform this skill at a professional level.    | A punter trying to play linebacker         |

**50 is the line — within your league.** Above it, you're a starter somewhere in
this league. Below it, you're fighting for your job. A young league whose 50s
and 60s would be 30s and 40s on an NFL scale doesn't care: inside the league,
those ratings mark the starter/backup boundary all the same.

\*_A note on the Geno Smith anchor._ The 50 line describes the **starter/backup
boundary within the league**, not a single real-world player's career
trajectory. Geno's actual career crosses the 50 line repeatedly — below it in
his Jets years, at or above it during peak Seattle, ambiguous after — and that's
exactly the point. The scale is sharper than any one player's arc because it's a
structural boundary, not a biography. He's the namesake because his career
_straddles_ the line; real players move across the tiers as circumstances,
health, coaching, and scheme change. Treat the anchor as a vibe, not a verdict.

### Bell curve distribution

Attributes across the league follow a natural bell curve, peaking around
**35-40**. This means the average player on a roster is a backup — which
reflects reality. Most roster spots are depth, not starters.

The distribution is **right-skewed with a steep dropoff at the elite end**:

- The bulk of the league clusters between 25-55
- Genuine starters (50+) are the minority of total players
- Quality starters (60+) are noticeably uncommon
- Franchise players (70+) are rare — maybe 2-3 per team at most
- Elite players (85+) are rare but real — roughly **3-5% per position**, which
  sums to about **25-40 across a 32-team league**. Think "a few per position,"
  not "a handful across the entire sport." An elite tier that's too thin
  collapses into generational and erases the everyday All-Pro layer that makes
  the league legible.
- Generational players (95+) are the true once-a-generation tier — **roughly one
  per decade per position**, meaning maybe 1–2 active generational players
  league-wide in any given season. When one exists, it's an event.

This means finding a 70+ player in the draft is a major win. Finding an 85+ is a
franchise-altering event. And if you somehow land a 95+, you've found a player
who will be discussed for decades.

### Position shapes are not the same bell

The universal bell above describes the league _in aggregate_. Individual
positions deviate from it in ways the sim needs to respect. The calibration
source of record is
[`data/docs/nfl-talent-distribution-by-position.md`](../../../data/docs/nfl-talent-distribution-by-position.md)
— consult it before tuning any position-specific generator.

Three archetypal shapes matter most:

- **Bimodal with fat tails (QB).** Quarterback is not a bell. There are ~12–15
  real starters and a long flat plateau of weak-starter / replacement arms
  behind them. The middle is thin; the tails are fat. This is why
  replacement-tier QB is a disaster and elite-tier QB is paid like nothing else.
- **Compressed toward the mean (OL, specialists).** Offensive linemen, kickers,
  punters, and long snappers cluster tight around 50. The drop-off from elite to
  replacement is real but smaller than at skill positions, and scheme /
  continuity explain more variance than raw talent. Ratings for these groups
  should ride closer to the mean with shorter tails.
- **Top-heavy with a long right tail (EDGE, to a lesser extent QB and iDL).**
  Pass rushers have a small, decisive elite cohort that rides much further from
  50 than other positions. The gap between a top-tier edge and a rotational
  rusher is larger than the gap between tiers at, say, safety or interior OL.

Other positions fall between these poles — WR and CB are closer to normal with a
modest elite tail; RB is flatter because replacement backs produce a surprising
share of what average starters do; TE is bimodal _by role_ (receiving vs
blocking) rather than by talent.

The takeaway for design: **a single league-wide bell is the starting point, not
the ceiling of sophistication.** Per-position generators should shape their
tiers against the distributions in the talent doc, not against the aggregate
curve.

### No overall rating

There is no OVR. Not for the user, and not under the hood. The simulation
doesn't care about a single number — it cares about specific attributes in
specific contexts. A quarterback's arm strength matters on a deep out route. His
pocket awareness matters under pressure. His speed matters on a bootleg.
Reducing a player to one number would erase the very thing that makes evaluation
interesting.

What users see instead:

- **The depth chart — set by your coaches, not by you.** Your coaching staff
  decides who starts, who backs up, and who's inactive. You don't drag names
  around on a depth chart screen. You hired these coaches and you trust them to
  evaluate the roster — or you don't, and you fire them. The depth chart is the
  primary signal of how your coaches value your players. A coach who values arm
  strength might start a cannon-armed gunslinger over a smart, accurate QB.
  You'll figure that out when the gunslinger throws three interceptions. The
  depth chart is coach output, not user input — and that means the quality of
  your coaching staff directly affects whether the right players are on the
  field.
- **Statistics tell the story after the fact.** Yards, touchdowns, completion
  percentage, tackles, sacks — the numbers paint a picture of how a player
  actually performed. If your coaches have a guy starting and his stats are
  terrible, either the coaches are wrong about him or the scheme doesn't fit
  him. You decide — by changing coaches, changing scheme, or acquiring different
  players. Not by overriding the depth chart yourself.
- **Scouting reports provide pre-acquisition assessments.** Before you draft or
  sign a player, your scouts give you their read — filtered through their own
  accuracy and biases (see [Scouting](./scouting.md)).

The depth chart is your coaches' answer to "who's the best?" The box score is
reality's answer. The gap between the two is where you, the GM, earn your keep —
not by micromanaging who plays, but by building a roster and coaching staff
where the right answers emerge naturally.

---

## Attribute Categories

Every player has attributes across four categories: **Physical**, **Technical**,
**Mental**, and **Personality**. Physical, technical, and mental attributes are
each an independent value on the 0-100 scale. Personality traits use the same
scale but affect off-field decisions and relationships rather than on-field
performance. All attributes are position-agnostic in structure but
position-specific in relevance — every player has an arm strength rating, but it
only matters for quarterbacks.

### Physical attributes

Physical attributes represent a player's raw athletic traits. These are the most
genetically constrained — a player's physical ceiling is largely set at birth.
Physical attributes are also the most vulnerable to age-related decline.

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

Mental attributes represent a player's cognitive and psychological makeup. These
are the hardest to evaluate through scouting and the most likely to surprise you
— positively or negatively — once a player is on your roster.

- **Football IQ** — understanding of the game; ability to read defenses/offenses
  pre-snap, make adjustments, understand complex schemes
- **Decision-making** — choosing the right option under pressure; knowing when
  to throw it away, when to take the sack, when to force a throw
- **Anticipation** — reading plays before they develop; throwing to where the
  receiver will be, jumping a route for an interception
- **Composure** — emotional control and discipline; resistance to drawing
  penalties, unsportsmanlike conduct, off-field behavioral issues; how a player
  handles adversity, frustration, and public scrutiny without it affecting his
  game or the locker room
- **Clutch** — performance in high-leverage game situations; the last two
  minutes, 4th-quarter comebacks, playoff games, prime-time moments; some
  players elevate when the stakes rise, others shrink
- **Consistency** — how much variance there is game-to-game; a consistent
  player's floor is close to his ceiling; an inconsistent player has brilliant
  games and terrible ones
- **Work ethic** — hidden drive to improve; affects development rate and how
  much a player grows between seasons
- **Coachability** — willingness and ability to learn from coaching;
  receptiveness to scheme changes and technique adjustments
- **Leadership** — impact on teammates' performance and morale; locker room
  presence

### Personality traits

Personality traits represent who a player is off the field — his motivations,
priorities, and psychological makeup. Unlike physical, technical, and mental
attributes, personality traits don't directly affect on-field play outcomes.
Instead, they drive decisions and relationships: how a player evaluates contract
offers, how he responds to media pressure, whether he'll take a discount to
stay, and how he reacts to being benched or tagged.

Personality traits are **hidden** and **hard to scout**. You get signals through
interviews, agent behavior, and a player's history of decisions — but the true
values are never visible. A player who _says_ he wants to stay might leave for
more money. A player who seems like a mercenary might surprise you with loyalty
after years of winning together.

- **Greed** — how heavily money weighs in the player's decisions; high-greed
  players almost always go to the highest bidder in free agency; low-greed
  players weigh other factors more heavily and are candidates for discounts
- **Loyalty** — attachment to his current team and organization; a loyal player
  gives a meaningful discount to re-sign and values relationships with coaches
  and teammates; disloyalty doesn't mean the player is selfish — it means he
  treats free agency as a purely professional transaction
- **Ambition** — drive to win championships; high-ambition players take
  discounts to join contenders, especially later in their careers when they've
  already been paid; low-ambition players don't factor team competitiveness into
  their decisions as heavily
- **Vanity** — desire for the spotlight and big-market prestige; high-vanity
  players prefer large media markets, nationally televised games, and
  franchise-player status; low-vanity players don't care whether they play in
  New York or Jacksonville
- **Scheme attachment** — how strongly a player prefers to stay in a familiar
  system; high scheme attachment means he'll weigh scheme fit heavily in free
  agency and may resist transitions to new systems; low scheme attachment means
  he's adaptable and treats scheme as a secondary consideration
- **Media sensitivity** — how much media coverage affects the player's morale
  and behavior; a media-sensitive player who gets praised plays with confidence,
  but one who gets criticized may spiral; a media-insensitive player tunes it
  all out — praise doesn't lift him, criticism doesn't bother him

These traits interact with each other and with game context. A player with high
loyalty and high ambition faces a genuine internal conflict when his team is
rebuilding — does he stay out of loyalty, or chase a ring elsewhere? A player
with high greed but high scheme attachment might take the money even if the new
team's scheme is a terrible fit — and then underperform because of it. The
combinations create realistic, distinct personalities that drive the off-field
drama of franchise management.

Personality traits are mostly stable but can shift in response to major career
events. A player who wins a championship might see his ambition decrease — he
got his ring. A player who's been franchise-tagged twice might see his loyalty
erode. A player who's been burned by media narratives might become more
media-sensitive over time, or might harden and become less sensitive. These
shifts are gradual and rare, not dramatic swings.

---

## Positional Relevance

Every player carries every attribute, but the simulation weights them by
position. Arm strength matters for a quarterback; it's irrelevant for a
cornerback. The full attribute list per position isn't a design document — it's
a simulation tuning exercise — but the principle is:

- **Each position has 5-8 primary attributes** that heavily influence
  performance in that role
- **Secondary attributes** provide marginal benefits (a fast offensive lineman
  is nice, but technique matters far more)
- **Irrelevant attributes** exist on every player but are ignored by the sim for
  that position

This means a player can have wildly different value depending on position. A
safety with elite man coverage (75) but poor zone coverage (40) is a liability
in a Cover-2 scheme but could thrive in a man-heavy defense. The attributes
don't change — the context does.

---

## Hidden Potential

Every player has a **hidden potential ceiling** for each attribute. This is the
maximum value that attribute can ever reach through development. Potential is
set when a player is generated and never changes.

### How potential works

- Potential is **per-attribute**, not a single number. A wide receiver might
  have a route running ceiling of 85 but a catching ceiling of only 60. He'll
  become a great route runner who drops too many passes — a specific, realistic
  player archetype.
- Potential is **completely hidden**. No scout, coach, or analytic tool can see
  it. You only discover it by watching what happens when a player gets
  opportunities and coaching.
- A player's **current attribute value** can be well below his potential. A
  rookie WR with 40 route running and 80 potential in that attribute has room to
  grow into a quality route runner — but only if he gets reps, good coaching,
  and time.
- A player whose current value already equals his potential in an attribute has
  **maxed out** that skill. No amount of coaching will improve it further. He is
  what he is.

### The boom-or-bust dynamic

Hidden potential is what creates the most exciting moments in the game:

- **The late-round steal**: A player drafted in the 5th round has low current
  attributes but sky-high hidden potential. He sits behind the starter for two
  years, developing quietly. When the starter gets hurt, the backup steps in and
  plays like a Pro Bowler. His potential was always there — he just needed the
  opportunity and development time.
- **The overdraft bust**: A player taken in the 1st round has high current
  attributes but low hidden potential. He looks great as a rookie because his
  skills are already near their ceiling. But he never improves. By year 3,
  mid-round picks have developed past him. His floor was his ceiling.
- **The unexpected breakout**: A player whose potential is high but whose
  development has been slow suddenly clicks — a new coaching staff, a scheme
  change, or just natural maturation. His attributes jump in a single offseason.
  These are rare but unforgettable.
- **The tragic decline**: A player whose physical potential ceiling is high but
  whose durability is low. Injuries erode his physical attributes below even his
  current level. The talent was there; the body betrayed him.

### Why coaches can't see potential

Coaches evaluate players based on what they can observe — current performance,
practice habits, and game tape. A coach might say "this kid has a high motor and
I think he can develop" — but that's the coach's imperfect read on the player's
work ethic and coachability, not a direct view of hidden potential.

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
- Decline is **not linear** — a player might hold steady for years and then drop
  off sharply, or erode gradually
- Injuries can permanently reduce physical attributes below a player's
  age-adjusted level; a torn ACL might take 3 points off speed permanently
- Physical attributes **cannot be coached up** beyond genetic ceiling — no
  amount of training makes a 4.6 runner into a 4.3 runner

### Technical attributes

Technical attributes are **the most improvable** and represent the primary axis
of player development:

- Improvement depends on: coaching quality, scheme stability, playing time
  (reps), work ethic, and coachability
- A player in a stable scheme with a great position coach develops faster than
  one bouncing between systems with a mediocre coach
- Technical development **continues through a player's prime** — a 30-year-old
  QB can still improve his accuracy if his mental processing and technique
  continue to sharpen
- Technical attributes decline later than physical ones, and more gradually — a
  veteran's technique often compensates for physical erosion
- Scheme changes can effectively "reset" some technical development — a zone
  blocking guard moving to a power scheme may regress in run blocking
  temporarily as he learns new techniques

### Mental attributes

Mental attributes follow their own trajectory:

- **Football IQ** tends to increase with experience — veterans read the game
  better than rookies
- **Decision-making** improves with reps and game experience but has a ceiling
  tied to the player's natural cognitive ability
- **Composure** can improve (a player matures, learns to control his emotions)
  or decline (frustration builds from losing, benchings, or off-field issues;
  penalties and outbursts become more frequent)
- **Clutch** can improve (players learn to thrive in big moments through
  experience) or decline (a player who's been burned in late-game situations
  might start playing tight when the stakes rise)
- **Consistency** is relatively stable but can shift — a player who cleans up
  his lifestyle might become more consistent; one dealing with off-field issues
  might become less so
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
- **Playing time** — see below
- **Scheme stability** — players in the same scheme year after year develop
  technical skills faster than those learning a new system annually
- **Age** — younger players develop faster; development rate slows with age

### Playing time and development

Playing time is one of the most important factors in player development — but
its effects are nuanced, not uniformly positive, and subject to diminishing
returns.

#### Practice reps vs. game reps

Not all reps are equal. **Game reps are worth significantly more than practice
reps** for development purposes.

- **Practice reps** provide a slow, steady baseline of development. A backup who
  never sees the field still improves — just glacially. Practice is controlled,
  low-stakes, and repetitive. It builds technical foundations but doesn't test
  mental attributes the way a live game does.
- **Game reps** accelerate development dramatically. The speed, pressure,
  unpredictability, and consequences of real games force adaptation that
  practice can't replicate. A player's decision-making, composure, clutch, and
  anticipation grow under fire in ways they never will holding a clipboard.
- The gap between practice and game development is largest for **mental
  attributes**. You can drill route running in practice. You can't drill reading
  a disguised Cover-2 with 70,000 fans screaming while the play clock ticks
  down.

This means a backup who's been "developing in practice" for three years is not
the same as a player who started for three years — even if the raw practice
hours are comparable. Game experience is irreplaceable.

#### Diminishing returns

The development benefit of playing time follows a curve of diminishing returns,
not a straight line.

- The biggest jump comes from **going from zero game reps to meaningful snaps**.
  A player who goes from clipboard holder to 20 snaps a game sees a significant
  development boost.
- Going from a rotational role to a full-time starter provides a real but
  smaller boost. The player is seeing more situations, more pressure, more
  complexity — but the marginal return per snap is lower.
- Going from a full-time starter to an every-down, never-comes-off-the-field
  workhorse provides **minimal additional development benefit**. At some point,
  a player is getting enough reps that more reps don't teach him anything new —
  they just add wear.

The implication: there's a sweet spot of playing time for development. A smart
team finds it. A lazy team just runs its best players into the ground.

#### When playing time hurts

More snaps are not always better. Playing time can actively harm a player in
several ways:

- **Too much, too soon.** A raw player thrown into a starting role before he's
  ready can suffer composure and confidence damage. Getting beaten repeatedly on
  national television doesn't build character — it builds bad habits and
  self-doubt. A young quarterback who's sacked 50 times behind a bad offensive
  line doesn't "learn from adversity." He learns to hear footsteps.
- **Physical wear and tear.** Heavy snap counts accelerate physical decline,
  especially at punishing positions. A running back who carries the ball 350
  times a season develops his vision and ball carrying — but his speed,
  durability, and stamina pay the price. The development gains on the technical
  side may not be worth the physical erosion.
- **Bad coaching compounding with reps.** Playing time under a bad coach can
  reinforce bad habits. A cornerback getting 1,000 snaps in a poorly coached
  scheme might develop worse technique than a backup getting 200 snaps under a
  great position coach. Reps amplify whatever a player is learning — good or
  bad.

#### Position-specific snap effects

The relationship between playing time and development is not uniform across
positions. Positions with higher physical toll see the tradeoff between
development benefit and physical cost more starkly:

- **Running backs** are the extreme case. Heavy workloads develop rushing vision
  and ball security but accelerate the decline of speed, durability, and stamina
  faster than any other position. A bell-cow back who carries 300+ times is
  learning, but his legs are aging in dog years.
- **Offensive and defensive linemen** absorb enormous physical punishment on
  every snap. Their technical development benefits from reps, but the cumulative
  toll on durability and stamina is real.
- **Quarterbacks** benefit the most from game reps with the least physical cost
  per snap (when protected). Mental and technical development from game
  experience is massive, and the physical toll is relatively low — unless the
  offensive line is bad, in which case the calculus changes entirely.
- **Wide receivers and defensive backs** fall in between — game reps are
  valuable for route running, coverage technique, and anticipation, with
  moderate physical cost.

### The opportunity question

This is where playing time and hidden potential combine to create the most
compelling stories in the game. A backup with enormous hidden potential sits
behind an established starter. His attributes develop slowly because he's not
getting game reps — just practice. Then the starter gets hurt.

The backup steps in and performs well — not because he magically got better
overnight, but because:

1. His practice reps have been slowly developing his technical foundations
2. His hidden potential means he has room to grow that the starter didn't
3. Game reps now accelerate his development dramatically
4. The coaching staff — and you — had no idea he was this close to being good

This is the Tom Brady story. The Kurt Warner story. The story this attribute
system is built to produce organically, without scripting it. The talent was
always there. It just needed the opportunity to emerge.

And this is also why workload management matters. The starter who got hurt?
Maybe he was carrying too many snaps. Maybe his physical attributes were eroding
under the load. Maybe the team that manages its depth chart — rotating players,
protecting young talent, resting aging legs — is the team that's still standing
in January.

---

## Interaction with Other Systems

### Scouting

Scouts evaluate attributes, but they never see the true values. A scout's report
is his best guess at a player's current skill, filtered through his own
accuracy, biases, and the depth of his evaluation. See [Scouting](./scouting.md)
for how this works.

Key interactions:

- Scouts assess **current attributes** (with noise and bias)
- Scouts **cannot see hidden potential** — they can guess at "ceiling" based on
  physical tools and age, but it's a guess
- Mental attributes are the **hardest to scout** — a few interviews and film
  sessions aren't enough to truly know a player's football IQ, composure, or
  clutch
- Physical attributes are the **easiest to scout** — combine numbers and film
  give a relatively clear picture

### Coaches

Coaches interact with attributes in two ways: they **evaluate** players (depth
chart decisions, scheme fit assessments) and they **develop** players (coaching
up technical skills, managing confidence). Coaches have their own biases and
accuracy — a coach who overvalues speed might start a fast but raw player over a
polished but slow one. See [Coaches](./coaches.md) for the full coaching system.

### Game simulation

The simulation engine consumes individual attributes — never an aggregate
overall rating. On every play, the relevant attributes for each player in that
context are what determine the outcome. A quarterback's deep accuracy matters on
a go route. His clutch matters in the final two minutes of a close game. His
football IQ matters when reading a disguised coverage.

This means a player can be dominant in one context and mediocre in another —
which is exactly how real football works. A power back with 85 strength and 45
speed will dominate short-yardage situations and disappear in the open field.
The attributes are the truth. The context determines which truth matters.

### Contracts and market value

A player's **perceived value** — what he can command on the market — is based on
what's visible: statistics, awards, reputation, and age. Not on hidden
attributes. This creates market inefficiencies:

- A player whose stats are inflated by scheme may be overvalued
- A player with elite hidden attributes who hasn't had opportunity may be
  undervalued
- An aging player whose physical decline hasn't shown up in the stats yet may be
  overvalued
- A young player whose technical development is about to take off may be
  undervalued

Exploiting these inefficiencies is a core GM skill.

---

## Related decisions

- [0026 — Initial player pool composition and attribute normalization](../decisions/0026-initial-pool-composition-and-attribute-normalization.md)
