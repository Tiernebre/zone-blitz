# Drafting

The draft is the single most exciting event on the game calendar. Everything
else — [scouting](./scouting.md), cap management, trading — exists to make draft
day meaningful. This document covers prospect generation, the draft board, draft
day itself, and the post-draft period.

---

## Prospect Generation

Every draft class is procedurally generated. The quality and composition of each
class varies — some years are deep at QB, others are barren. This
unpredictability is essential: you can't plan to "draft a franchise QB in year
3" because there might not be one available.

### Draft class archetypes

Each generated class has a character:

- **Deep class**: Lots of quality prospects, especially in the middle rounds.
  Good year to trade down and accumulate picks.
- **Top-heavy class**: A few elite prospects and then a steep drop-off. Creates
  intense competition (and trade-up drama) at the top.
- **Weak class**: No sure things. Lots of risk. The smart move might be to trade
  your picks for future years.
- **Positional strength**: Some years are loaded at WR but thin at OL. This
  affects the entire league's approach — if everyone needs a corner and there
  are only two good ones, those picks become trade assets.

### Player archetypes within a class

Prospects aren't just bundles of random attributes. Each prospect is generated
around an **archetype** — a coherent player type that determines their attribute
profile, strengths, weaknesses, and ceiling.

**QB archetypes (examples):**

| Archetype               | Profile                          | Strengths                             | Risks                                   |
| ----------------------- | -------------------------------- | ------------------------------------- | --------------------------------------- |
| Franchise Pocket Passer | Tall, strong arm, reads defenses | High floor, scheme-versatile          | Low mobility, needs OL protection       |
| Dual-Threat Playmaker   | Athletic, extends plays, runs    | Dynamic, stresses defenses            | Injury risk, sometimes forces plays     |
| Game Manager            | Accurate, smart, limited arm     | Low turnover, efficient               | Low ceiling, doesn't elevate talent     |
| Project Cannon          | Elite arm talent, raw mechanics  | Highest ceiling in the class          | Longest development timeline, bust risk |
| Spread System QB        | Quick release, timing routes     | Productive in college, fast processor | Will it translate? Scheme-dependent     |

Similar archetype tables exist for every position group. The point isn't to make
every prospect a trope — it's to give each one a coherent identity that scouts
can evaluate and GMs can debate.

### Prospect "truth" vs. perception

Every prospect has a **true attribute profile** that determines how they'll
actually perform in the league. This profile is never directly visible to the
player. What you see is always filtered through [scouting](./scouting.md).

The gap between truth and perception is the game:

- **Easy-to-read prospects**: Physical freaks with obvious talent. Most scouts
  agree, and the consensus is usually right. These go high in the draft and
  rarely surprise anyone.
- **Polarizing prospects**: Unusual builds, unconventional skill sets, or red
  flags that some scouts dismiss and others fixate on. One scout says top-10
  talent, another says third-round grade. The truth might be either.
- **Hidden gems**: Players at small schools or with limited tape. Without deep
  scouting, they're invisible. With deep scouting, they might be steals.
- **Fool's gold**: Prospects who test well and interview great but whose
  on-field performance won't translate. They look like first-rounders until you
  watch them play on Sundays.

### Prospect traits and intangibles

Beyond physical and technical attributes, every prospect has mental attributes
and personality traits that affect their career trajectory. These are defined in
[Player Attributes](./player-attributes.md) — the same attributes that drive
every player in the simulation also exist on prospects before the draft.

What makes these traits special for drafting is that **they're the hardest
things to scout accurately**. Physical measurables are relatively objective —
you can time a 40. Technical skills show up on film. But a prospect's mental
makeup and personality are opaque:

- **Work ethic, coachability, football IQ** — the traits that determine
  development trajectory. A scout gets a few interviews and background calls to
  assess years of hidden habits. High-work-ethic players who seem lazy in
  interviews, and lazy players who interview brilliantly, are both common
  scouting traps.
- **Composure, clutch, consistency** — how a prospect handles pressure, big
  moments, and week-to-week variance. College data is noisy — a prospect who was
  "clutch" against Big 12 defenses might fold against NFL pressure. Small sample
  sizes make these almost impossible to evaluate with confidence.
- **Leadership** — locker room presence and impact on teammates. Some prospects
  are obvious leaders. Others are quiet until they earn trust. Scouts overvalue
  vocal leadership and undervalue the subtle kind.
- **Personality traits** (greed, loyalty, ambition, vanity, scheme attachment,
  media sensitivity) — these drive off-field decisions but are nearly invisible
  in a pre-draft setting. A prospect's agent, interview demeanor, and college
  decision history provide faint signals, but personality is the area scouts get
  wrong most often.

This is where scouting depth and scout quality really matter. A quick look might
surface physical and technical assessments. Getting a real read on mental and
personality traits requires deep dives, multiple interviews, and extensive
background work — and even then, scouts get it wrong all the time.

---

## The Big Board

### Building your board

The big board is your private ranking of prospects. No one else sees it.
Building the board is the synthesis of all your [scouting](./scouting.md) work.

**Board structure:**

- **Tiers**: Group prospects into tiers rather than precise 1-through-300
  rankings. Within a tier, players are roughly interchangeable — the differences
  are positional need and scheme fit, not talent.
  - Tier 1: Elite / franchise-caliber
  - Tier 2: Pro Bowl potential / high-end starter
  - Tier 3: Solid starter
  - Tier 4: Quality depth / developmental starter
  - Tier 5: Rotational player / special teams
  - Tier 6: Camp body / long-shot
- **Within-tier ranking**: You can rank within tiers for tiebreaking, but the
  tier boundaries are the key decisions
- **Tags and notes**: Mark prospects with custom tags (e.g., "must-have,"
  "scheme fit," "character concern," "sleeper") and attach notes

**Board views:**

- **Overall board**: All prospects, ranked by your tiers
- **Positional board**: Show just QBs, or just edge rushers, ranked by tier
- **Scheme-filtered board**: Show prospects who fit your scheme, ranked by
  scheme fit + talent
- **Need-based board**: Highlight positions where your roster has gaps
- **Value board**: Where you think a prospect will actually be picked vs. where
  you have them ranked — identifies potential steals and reaches
- **Comparison view**: Side-by-side scouting reports from multiple scouts on the
  same prospect

### Mock draft simulations

Before draft day, you can run mock draft simulations:

- The game simulates NPC teams' picks based on their known needs and tendencies
  (with uncertainty — you don't know their boards)
- Run multiple simulations to see a range of outcomes: "In 100 mocks, my target
  falls to me at pick 14 about 35% of the time"
- Helps inform trade-up/trade-down strategy
- Mock results are probabilistic, not deterministic — the real draft will always
  surprise you

### Consensus big board (public)

A league-wide "media consensus" big board is public information:

- Roughly mirrors the average of all teams' evaluations (with noise)
- Useful as a baseline: if a prospect is consensus top-10 and you have them in
  the 3rd tier, either you're seeing something others aren't, or your scouts are
  wrong
- NPC teams' boards deviate from consensus based on their personality and scheme
  — the consensus isn't a prediction of what will happen

### Media mock drafts

In addition to the consensus big board (which ranks prospects), media analysts
publish mock drafts (which predict pick-by-pick selections for each team). See
the [Scouting — Media Mock Drafts](./scouting.md#media-mock-drafts) section for
the full vision on how mock drafts work, how they're generated, and how your
scouts may (or may not) be influenced by them.

Mock drafts are a key part of the pre-draft experience:

- They project what other teams might do — useful for planning trades
- They tell you what the media thinks YOUR team needs — sometimes insightful,
  sometimes laughably wrong
- They create emotional stakes: seeing "your guy" mocked to the team picking one
  spot ahead of you is the kind of pre-draft anxiety that makes the actual draft
  feel electric

---

## Draft Day

The draft itself should be the most exciting event in the game calendar.

### Live draft (multiplayer)

- Real-time, pick-by-pick progression
- On-the-clock timer for each pick (configurable by league — e.g., 3 minutes for
  round 1, 2 minutes for rounds 2-3, 90 seconds for later rounds)
- **Trade offers fly in while you're on the clock** — other GMs trying to trade
  up to your spot. Do you take the deal or make your pick?
- The tension of watching picks happen and seeing your targets get taken
- Auto-draft with pre-set board for absent human GMs
- Pick announcements with prospect info (measurables, school, position)
- Running tracker: who's been picked, who's still available, how your board is
  falling

### Single-player draft

- NPC teams draft according to their AI personality, scheme needs, and board
- Trades happen around you — NPC teams trade up/down dynamically
- You can pause to evaluate (no real-time pressure unless you want it)
- "Breaking news" style updates: trade announcements, surprise picks, draft-day
  falls
- Commentary/analysis: "Experts are surprised the Lions passed on the consensus
  top QB" — adds texture and helps you assess what happened

### On-the-clock decisions

When it's your turn to pick, you face the core decision tree:

1. **Pick the best player on your board** — straightforward BPA approach
2. **Pick for need** — take the best player at a position you need, even if he's
   not the top-ranked player on your board
3. **Trade down** — if there's no player you love at this spot, trade back for
   more picks. You lose certainty (your target might be gone) but gain assets.
4. **Trade up** — if a player you covet is about to be taken by the team ahead
   of you, offer assets to jump up. You gain certainty but pay a premium.
5. **Take the "value pick"** — a player who fell further than expected. He might
   not fill a need, but the talent is too good to pass up. You can always trade
   him later.

The right answer depends on your board, your needs, your scheme, your
competitive window, and what other teams are doing. There is no formula. That's
the point.

### Draft-day trades

Trades during the draft follow all the rules from the [Trading](./trading.md)
vision, but with added urgency:

- **Trades can happen at any time** — you don't have to be on the clock to make
  a deal. As the draft unfolds and boards shift, teams will swap picks to
  reposition for later rounds. A run on QBs in round 1 might trigger a flurry of
  trades among teams picking in round 2.
- **On-the-clock pressure** — the timer doesn't stop for trade negotiations (in
  multiplayer). You can negotiate and pick simultaneously, but the pressure is
  real.
- **Picks become more valuable as you get closer to the top** — a team at #3
  overall has enormous leverage if two teams behind them both want the same QB
- **Future pick trades** — "I'll give you my next year's 1st to move up 5
  spots." Mortgaging the future for a player you believe in.
- **Draft-day package deals** — multiple picks to move up, or a player + pick to
  move up. Complex deals under time pressure.

### Draft-day drama

The system should generate moments:

- **The slide**: A consensus top-10 prospect falls to the 20s. Why? Did teams
  see red flags? Is it a scheme thing? If he falls to you, is it a gift or a
  trap?
- **The run**: Three QBs go in four picks. Suddenly the position is scarce.
  Teams that needed a QB and didn't get one are scrambling.
- **The surprise pick**: An NPC team reaches for a prospect ranked much lower on
  consensus boards. Were they smarter than everyone, or did they panic?
- **The trade frenzy**: Multiple teams trying to trade into the same spot,
  bidding against each other for the right to pick next.
- **The fall-and-snatch**: You watch your guy fall, pick by pick, holding your
  breath. He's still there at your pick. You grab him. That feeling.
- **The heartbreak**: One pick before yours, a team takes your guy. Now what?
  Your backup plan matters.

---

## Post-Draft

### Undrafted Free Agent (UDFA) signing

After the draft, undrafted prospects sign as free agents:

- You have limited UDFA signing bonus budget (separate from regular cap)
- Competition for the best UDFAs is real — multiple teams will want the same
  undrafted prospects
- UDFA evaluation relies on your scouting from earlier — if you scouted a
  prospect who went undrafted, you have an information edge
- Some UDFAs become real contributors (historically, ~20% of NFL rosters are
  UDFAs). This is where thorough scouting pays off for prospects the league
  overlooked.

### Rookie contracts

- Drafted players sign contracts based on draft slot (rookie wage scale)
- Higher picks get bigger contracts — but they're still cheap relative to
  veteran free agents
- Rookie contracts create the "rookie window" — a 4-5 year period where you have
  a good player at below-market cost. This is the foundation of team-building
  strategy.
- 5th-year option on first-round picks — an additional year of cost control if
  the player develops

### Roster integration

After the draft, new players join the team:

- Training camp battles — rookies compete for roster spots with veterans
- Scheme learning curve — rookies in a new system take time to adjust (affected
  by football IQ and coachability traits)
- Redshirt potential — some rookies aren't ready year 1 but develop into
  starters by year 2 or 3
- Practice squad stashing — develop players without using a roster spot (but
  other teams can poach them)

---

## Draft Grades

The media reports on every team's draft immediately after it happens, and the
game tracks those grades historically so you can revisit them years later.

### Immediate draft grades

Right after the draft, media analysts publish grades for every team's class:

- Each team gets a letter grade (A+ through F) with written analysis
- Grades factor in consensus value vs. pick slot, positional need, and scheme
  fit — but they're working with the same incomplete information everyone else
  has
- Grades are often wrong — a "C-" draft class can produce multiple All-Pros, and
  an "A" class can bust entirely. That's part of the fun.
- Every team's grade is public and visible league-wide — immediate fuel for
  debate and trash talk

### Historical draft grade tracking

Draft grades are permanently archived. You can go back to any past draft and
see:

- **The original grade**: What the media said at the time. "2042 Eagles draft:
  C-. Reached for a corner in the 2nd, questionable value throughout."
- **The re-grade**: A retrospective analysis based on how those players actually
  performed. Updated as careers develop — a draft class looks different after 1
  year, 3 years, and 5 years.
- **The narrative**: The re-grade includes commentary on the biggest surprises.
  "That 4th-round CB the media panned became a franchise cornerstone and
  anchored the secondary during their 2045 Super Bowl run."
- **Side-by-side comparison**: View the original grade next to the re-grade to
  see how wrong (or right) the initial takes were

### Re-grade triggers

The game periodically re-evaluates past drafts:

- **After year 1**: Early returns — who's contributing, who's buried on the
  depth chart?
- **After year 3**: The real picture starts to form. Starters have emerged,
  busts are clear, late-round gems are surfacing.
- **After year 5**: The definitive re-grade. Careers are established. The
  verdict is in.

This creates a long-tail payoff for every draft. A decision you made years ago
can be vindicated — or exposed — as time passes. It gives every draft class a
story that evolves.

---

## League Genesis

This document describes drafting in a mature Zone Blitz league — rookie classes
scouted over the preceding year, draft order seeded by prior-season standings, a
full rookie-draft cycle slotted into the offseason.

Year 1 of a newly founded league is different. See
[League Genesis](./league-genesis.md) for the canonical rules; the draft-
specific points:

- **No Year 1 rookie draft.** Every player — including rookie-age talent —
  enters the league through the founding player pool and the **allocation
  draft**, which is Year 1's only draft. Draft order is randomized, since no
  prior standings exist to seed from.
- **Year 2 is the first real rookie draft.** It uses the core mechanics
  documented here, with draft order set by Year 1 standings. Every subsequent
  offseason follows the standard cycle.
- **Founding-era uncertainty is amplified.** Scouts are brand new, the player
  pool is a mix of unconventional archetypes (raw college athletes,
  practice-squad journeymen, back-end vets, middling pros with something to
  prove), and attributes are normalized to the league's own scale. Gems and
  busts are more frequent in the allocation draft than in any later rookie draft
  because no one has evaluation history yet.

---

## What Makes Drafting Fun

The draft is fun because of **meaningful uncertainty**. You're making
consequential decisions with incomplete information, and you won't know if you
were right for years.

But it's also fun because of **bragging rights and ego**. The draft is a public
scorecard. Every pick is a statement, and every other GM in your league has an
opinion about it. The game should feed this competitive energy — draft grades,
re-grades, and historical tracking (see [Draft Grades](#draft-grades)) give
everyone the receipts to back up their trash talk.

The best draft experiences:

- "I had him ranked 15th but he fell to me at 22 — steal or did everyone else
  see something I missed?"
- "My scout says this QB is a franchise player, but he only did a quick look. Do
  I trust it?"
- "I need a corner badly but the best player on my board is a DT. Do I reach for
  need or take the value?"
- "Another GM is offering me a future 1st to trade down. Is the gap between my
  #1 and #2 prospect big enough to say no?"
- "Three QBs went in four picks and the run completely reshaped the board. The
  edge rusher I didn't expect to be there at 18 is sitting right there."
- "I traded next year's 1st to move up for my guy. If he hits, it's genius. If
  he busts, I mortgaged the future for nothing. I won't know for three years."
- "Everyone clowned my second-round pick. Two years later he's All-Pro and their
  guy is out of the league."

---

## Related decisions

- [0023 — Allocation draft as Year 1's only draft](../decisions/0023-allocation-draft-as-year-one-only-draft.md)
