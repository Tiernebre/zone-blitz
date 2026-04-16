# Scouting

Scouting is the information engine of the entire game. Every major decision you
make — drafting, trading, free agency, scheme selection — depends on how well
you evaluate talent. And you never evaluate talent directly. You evaluate it
through your scouts, who are themselves imperfect instruments that you must
learn to read over time.

## Core Design Principle: Information Asymmetry Everywhere

Nothing in this game has a visible "true" rating. Not prospects. Not scouts. Not
coaches. You operate in a fog of partial, biased, and uncertain information at
every level:

- **Prospects** have true attributes, but you only see filtered scouting reports
- **Scouts** have true accuracy and biases, but you only see their resumes,
  reputations, and track records over time
- **Other teams' evaluations** are hidden — you don't know what they think about
  a prospect unless they tip their hand through trades or picks

This layered uncertainty is the game. The skill isn't in reading numbers off a
screen — it's in building an evaluation process you can trust, learning where it
fails, and making better decisions under uncertainty than your opponents.

---

## Your Scouting Department

You manage a scouting staff. This is a resource allocation game within the
larger game.

### Scout attributes are hidden

Just like you never see a prospect's true ratings, **you never see a scout's
true accuracy, biases, or positional specialties**. You don't hire a scout and
see "87 accuracy, specializes in defensive line." You hire a scout and all you
know is:

- **Resume/background**: Former position coach? Former player? Years of
  experience? Which organizations has he worked for? This is flavor and signal,
  but not a stat sheet.
- **Reputation**: Other scouts and GMs in the league have opinions. A scout
  known as "one of the best eyes in the ACC" might genuinely be elite — or might
  be coasting on a few lucky calls.
- **Track record with your organization**: Once a scout has worked for you, you
  can compare his past evaluations against actual player outcomes. This is the
  only hard data you get, and it takes _years_ to accumulate.
- **Track record across the league**: If a scout previously worked for another
  team, you might see aggregate information — how did players he reportedly
  championed actually perform? But this is noisy and secondhand.
- **Salary demands**: Better scouts generally cost more. But "costs more"
  doesn't guarantee "is better" — some scouts are overpaid, some are bargains.

This means **hiring a scout is itself a scouting problem**. You're evaluating an
evaluator with incomplete information. A scout with a great resume might have
hidden biases that tank his accuracy for certain positions. A cheap, unknown
scout might turn out to be your best eye for OL talent. You won't know until
you've seen enough of his work to judge — and by then, you've either benefited
from his insight or been burned by his misses.

### Under the hood (invisible to the player)

Each scout has hidden attributes that drive the quality and character of their
evaluations:

- **Accuracy**: How close their evaluations are to the truth (overall)
- **Positional accuracy modifiers**: Better or worse at evaluating specific
  positions (e.g., +15% accuracy for DL, -10% for QBs). These are the
  "specialties" you'll discover empirically.
- **Biases**: Systematic tendencies — overrates speed, underrates OL technique,
  falls in love with "his guys," overweights character concerns, etc. You
  discover these over time by noticing patterns in where his reports diverge
  from reality.
- **Work capacity**: How many prospects they can evaluate per scouting period.
  This one you CAN see — it's a practical constraint, not a hidden trait.
- **Personality**: Some scouts are confident in their evaluations (strong
  grades, high conviction). Others are hedgers (lots of "could go either way"
  reports). Neither is inherently better — a confident scout gives you clear
  signals but might be overconfident; a hedging scout is more cautious but less
  actionable.
- **Potential**: A hidden ceiling on how good this scout can become. Just like a
  player prospect, some scouts have the raw talent to become elite evaluators;
  others have a lower ceiling no matter how much experience they accumulate.

### Scout development and career arcs

Scouts aren't static. They develop, peak, and decline — just like the players
they evaluate. This is all hidden from you; you only see the results change over
time.

**Development factors (hidden):**

- **Experience**: Scouts improve with reps. A young scout in his first few years
  is still calibrating his eye. After 5-8 years of evaluating prospects and
  seeing how they turn out, he's learned from his hits and misses. His accuracy
  improves — but only up to his potential ceiling.
- **Potential**: Just like a player prospect, every scout has a hidden ceiling.
  A high-potential scout hired cheap out of a college coaching job might develop
  into one of the best evaluators in the league. A low-potential scout with a
  great resume might already be as good as he'll ever get — or might even be
  coasting on reputation.
- **Environment**: Scouts develop better under a strong scouting director — good
  leadership sharpens the whole staff. A scout paired with a great director
  improves faster than one working under a mediocre director. Your
  infrastructure investments (analytics tools, film resources) also contribute
  to development.
- **Specialization deepening**: A scout who repeatedly evaluates the same
  position group or region gets better at it over time. If your ACC scout has
  been watching ACC defensive linemen for 6 years, his DL accuracy may have
  improved significantly — even if his LB evaluations haven't.

**Career arc patterns (hidden, discovered through observation):**

- **The gem**: A cheap, unknown hire who develops into an elite evaluator. You
  notice it after 3-4 drafts when his grades consistently predict outcomes
  better than anyone else on staff. These are the scouting equivalent of a
  late-round draft steal — and just as satisfying to discover.
- **The bust**: An expensive hire with a great reputation who never delivers.
  His grades are inconsistent, his biases are severe, and he doesn't improve.
  Maybe he was always overrated. Maybe the game passed him by. You figure it out
  the hard way — by watching his evaluations miss.
- **The steady veteran**: Reliable, consistent, no surprises. Not the best scout
  on staff, but you know exactly what you're getting. His accuracy is solid and
  his biases are well-understood. There's value in that predictability.
- **The rising star**: A young scout whose evaluations get noticeably sharper
  each year. His year-1 grades were rough, but by year 3 he's your most accurate
  evaluator for his region. You're watching a scout hit his stride.
- **The declining veteran**: A scout who was once great but is losing his edge.
  Maybe the game has changed (new offensive schemes, different player
  archetypes) and his evaluation framework hasn't adapted. His accuracy is
  slipping, but it's happening gradually — hard to notice unless you're tracking
  the data.
- **The specialist**: Average overall, but elite for one position group. His OL
  evaluations are the best on staff; everything else is mediocre. Worth keeping
  if you know how to deploy him.

**What you see vs. what's happening:**

You never see "Scout A's accuracy improved from 72 to 78 this year." What you
see is: "Scout A's evaluations this draft cycle were more on-target than last
year's. His top 3 grades all became starters. Last year only 1 of his top 3
did." Is that development, or is it noise? You have to decide — with the same
incomplete information you use for everything else in this game.

Over many years, the signal gets clearer:

- A scout who was shaky in years 1-2 but has been excellent in years 3-6 has
  probably developed. You can increase your trust.
- A scout who was great in years 1-4 but has missed badly in years 5-7 might be
  declining. Do you stick with him based on his track record, or is the recent
  data more telling?
- A scout who has been mediocre for 8 straight years is probably at his ceiling.
  He's a known quantity — useful, but don't expect improvement.

**Aging and decline:**

Like players, scouts eventually decline:

- Mental sharpness, willingness to travel, and adaptability to new player
  archetypes may erode with age
- Some scouts age gracefully — their experience compensates for declining
  sharpness, and they remain valuable for their institutional knowledge
- Others fall off — stuck evaluating prospects through an outdated lens,
  overvaluing traits that mattered 15 years ago
- Retirement happens naturally — veteran scouts eventually step away, creating
  turnover you have to manage

**The parallel to player management:**

This system creates a scouting staff lifecycle that mirrors the roster
lifecycle:

- **Draft (hire)**: You're evaluating potential with incomplete information.
  Resume and reputation are the combine numbers — useful but not the full
  picture.
- **Development**: Young scouts need time to grow. Don't overreact to early
  misses. Give them reps and a good environment.
- **Prime years**: Experienced scouts in their prime are your most valuable
  evaluators. Maximize their deployment.
- **Extension decisions (retention)**: A scout whose contract is up demands a
  raise based on reputation. Is he worth it? Your track record data says yes for
  DL, no for QB. Do you pay for the DL value and live with the QB weakness?
- **Decline management**: When do you move on from an aging scout? Too early and
  you lose institutional knowledge. Too late and you're paying for declining
  output.
- **Succession planning**: If your best scout is aging, you should be developing
  his replacement now — not scrambling when he retires.

### Staff roles

**Scouting director**

- Your top evaluator and the person who synthesizes reports from the full staff
- A great director improves the "consensus" view by weighing scouts
  appropriately — but you can't see how he's weighing them
- Affects the overall quality of your scouting operation
- Hired/fired like any other staff member — and evaluated the same way: by
  results over time, not by a visible rating
- A new scouting director might reorganize your scouting priorities, re-assign
  regions, or push for different evaluation philosophies. This is a real
  personnel decision with consequences.

**Area scouts**

- Each area scout covers a geographic region or conference
- They're your eyes in areas you can't see yourself
- You hire them based on resume, reputation, salary, and (if available) past
  track record — not based on visible attribute numbers
- Over multiple drafts, you build a picture of each scout: "My ACC guy has
  nailed his last three DL evaluations but whiffed badly on two linebackers"

**National scouts / cross-checkers**

- Senior scouts who provide second opinions on top prospects
- Generally more experienced (and more expensive) than area scouts
- Sending a cross-checker gives you a second independent evaluation to compare
  against the area scout's report — agreement increases confidence, disagreement
  is a signal to dig deeper
- Cross-checkers have their own hidden attributes too — a cross-check isn't
  automatically more reliable, it's just a second opinion

**Staff size and budget**

- You have a finite scouting budget that is **separate from the salary cap**.
  Scouting is a front office operating expense — it doesn't compete with player
  or coaching salaries for cap space. But it is still finite, and how you
  allocate it is a real strategic decision.
- More scouts = more coverage, but each additional scout has diminishing returns
- Salary varies: experienced scouts with strong reputations command higher pay,
  but a cheaper unknown scout might outperform an expensive name
- A trade-off: a small staff of expensive, reputable scouts vs. a large staff of
  cheaper, unproven ones
- You can also invest in scouting infrastructure: analytics tools, film
  resources, medical staff — these improve the overall operation but cost money
  that could go to scout salaries

---

## Evaluating Your Evaluators

Since scout attributes are hidden, you need to build your own assessment through
observation and data. This is a meta-game that unfolds over the life of your
franchise.

### Short-term signals (1-2 drafts)

- Did the scout's top-rated prospect perform well in training camp?
- Are players the scout loved contributing as rookies?
- Very noisy — small sample size. A scout who misses on one player isn't
  necessarily bad. Resist overreacting.

### Medium-term signals (3-4 drafts)

- Enough data to spot patterns: "He's 0-for-3 on QBs but 5-for-6 on defensive
  linemen"
- Bias patterns emerge: "Every prospect he loves is a combine freak — he's
  weighting athleticism too heavily"
- You can start making calibrated trust decisions: use him for DL evaluations,
  get a cross-check on his QB grades

### Long-term signals (5+ drafts)

- Statistically meaningful track record
- You know his strengths, weaknesses, and biases well
- He's become a known quantity — which is valuable even if he's not the most
  accurate scout on staff. A scout whose biases you understand is more useful
  than a new scout whose biases you don't.
- But long-term data also reveals development arcs: is this scout getting
  better, plateauing, or declining? A scout who was mediocre in years 1-3 but
  excellent in years 4-6 was developing — and you almost fired him too early. A
  scout who was great in years 1-4 but has been slipping in years 5-7 might be
  declining — and loyalty shouldn't blind you to the trend.

### The meta-game

The best GMs in this game will build an institutional knowledge base about their
scouting staff that is as valuable as the scouting reports themselves. "I know
my guy overrates speed by about half a tier, so when he says this burner is a
1st-rounder, I mentally adjust to early 2nd." This is the kind of deep, earned
knowledge that rewards franchise longevity and makes year 10 of a franchise feel
fundamentally different from year 1.

The development system adds another layer: you're not just learning _what_ a
scout is — you're also making bets on _what he could become_. Do you keep the
rough-around-the-edges young scout because you think he's developing? Do you
invest in a scouting director who might accelerate your whole staff's growth? Do
you stick with an aging veteran whose output is declining but whose
institutional knowledge is irreplaceable? These are the same kinds of judgment
calls you make about players — and they're just as consequential.

---

## Scouting Levels

When you assign a scout to evaluate a prospect, you choose the depth of
evaluation. This is where the resource allocation happens — you have a finite
budget of scouting points and 300+ prospects to evaluate.

### Quick look (1 scouting point)

- Brief evaluation — often based on highlight tape and measurables
- Produces: overall grade (vague range, like "2nd-3rd round talent"), one-line
  summary
- Useful for: initial filtering, casting a wide net early in the process
- Accuracy: low. Could be way off. But it's cheap.

### Standard evaluation (3 scouting points)

- Multiple viewings, film study, basic background check
- Produces: position-specific skill grades (with moderate confidence), physical
  assessment, basic character read, scheme fit estimate
- Useful for: building your board, evaluating mid-round targets
- Accuracy: moderate. You get a decent picture but could miss things.

### Deep dive (6 scouting points)

- Extensive film study, in-person workout evaluation, interview, background
  investigation, medical review
- Produces: detailed attribute grades (with high confidence), full character and
  intangibles report, injury history assessment, ceiling/floor projection,
  detailed scheme fit breakdown
- Useful for: first-round decisions, high-investment picks, prospects you're
  genuinely considering trading up for
- Accuracy: high — but not perfect. Even deep dives get it wrong sometimes.

### Cross-check (2 additional scouting points)

- A second scout evaluates the same prospect independently
- Produces: a second set of grades to compare against the first
- If both scouts agree, your confidence is high. If they disagree, you have a
  decision to make.
- Useful for: polarizing prospects, confirming/denying your area scout's take

### The budget constraint

A typical staff might have ~200 scouting points per draft cycle. With 300+
prospects, you _cannot_ deep-dive everyone. The allocation is the strategy:

- Deep dive 15 top targets (90 points)
- Standard evaluations on 25 mid-range targets (75 points)
- Quick looks on 35 names to cast a wide net (35 points)
- That's your entire budget. Everyone else is a mystery.

Or you go wide: quick looks on 100 prospects (100 points), standard evals on the
30 most interesting (90 points), one deep dive on your top target (6 points).
Different strategy, different tradeoffs.

Your scouting philosophy — go deep on a few, or go wide on many — is one of the
most consequential decisions you make each year, and the right answer changes
based on your draft position, needs, and the shape of the class.

---

## Scouting Reports

Reports should feel like real scouting reports, not stat sheets.

### What a report contains

- **Physical measurables** — height, weight, 40 time, etc. These are relatively
  objective (combine numbers are public) but how they translate to on-field
  performance is uncertain.
- **Skill grades** — your scout's assessment of specific abilities (arm
  strength, route running, block shedding, etc.). These are subjective and vary
  by scout. A grade from one scout isn't directly comparable to the same grade
  from another scout until you've calibrated your understanding of each scout.
- **Intangibles/character** — work ethic, leadership, football IQ, injury
  history. Hard to quantify, often decisive. These are the grades that vary most
  between scouts and scouting levels.
- **Scheme fit assessment** — how well does this prospect fit YOUR scheme? A
  prospect your scout loves might be a terrible fit for what you run. This
  assessment is only as good as your scout's understanding of your scheme.
- **Confidence level** — how sure is the scout about this evaluation? A "B+
  grade with high confidence" is very different from a "B+ grade with low
  confidence." But remember: a confident scout might be overconfident. Trust the
  confidence level after you've learned whether a particular scout's confidence
  is well-calibrated.
- **Comparison/projection** — "Reminds me of a poor man's [established player]"
  type assessments that may or may not be accurate. These are evocative but
  unreliable — a useful starting point, not a conclusion.
- **Red flags** — specific concerns the scout wants to highlight: injury
  history, character issues, scheme-dependency, one-year production spike, weak
  competition level, etc.

### Interpreting reports

The same prospect evaluated by two different scouts might look very different:

```
Prospect: Marcus Chen, Edge Rusher, Alabama

Scout A (area scout, Southeast region):
  Overall: Top-15 talent
  Pass Rush: A        Run Defense: B-
  Athleticism: A+     Technique: B
  Character: Clean
  Scheme Fit (3-4 OLB): Excellent
  Confidence: High
  "Explosive first step, violent hands. Best pure pass rusher in this class.
   Run defense is a work in progress but the physical tools are there."

Scout B (national cross-checker):
  Overall: Late 1st / Early 2nd
  Pass Rush: B+       Run Defense: C+
  Athleticism: A      Technique: B-
  Character: Some concerns (coachability questions)
  Scheme Fit (3-4 OLB): Good
  Confidence: Moderate
  "Undeniable athleticism but relies too much on the speed rush. Gets
   washed out against the run. Interviews raised minor coachability
   questions. High ceiling if he develops counter moves; risky if he
   doesn't."
```

Who's right? Maybe Scout A, who watches Southeast prospects all year, knows this
player better. Maybe Scout B, as a cross-checker, has a broader perspective and
is less susceptible to being wowed by watching one dominant player repeatedly.
Maybe Scout A has a known bias toward overrating athleticism. Maybe Scout B is
too conservative with his grades.

**You decide.** The game gives you the data. The interpretation is your job.

---

## Scouting Timeline

Scouting happens across a calendar that mirrors the real NFL. Each phase
produces different information at different costs.

### Early season (September-November)

- College season is underway
- Area scouts begin evaluating players in their regions
- You set priorities: which positions to focus on, which regions matter
- Early returns are the roughest — small sample size, lots of uncertainty
- This is the best time for quick looks — cast a wide net while the season is
  still playing out

### Late season (December-January)

- Bowl games and playoff performances add data
- Prospects declare for the draft (underclassmen decisions)
- The prospect pool solidifies — you now know who's in the class
- Time to narrow focus and start deep dives on top targets
- Underclassmen declaring creates new evaluation needs — players you may not
  have been tracking are suddenly draft-eligible

### Senior Bowl / All-Star games (late January)

- Top prospects compete against each other in practices and a game
- Your scouts attend and evaluate — these events reveal how players perform
  against elite competition
- Interview opportunities with prospects
- Small-school prospects get a chance to shine (or struggle) against major
  conference talent
- Practice reports are often more revealing than the game itself — coaches run
  NFL-style practices and scouts can see who picks things up quickly

### Combine (February-March)

The public evaluation event. Athletic testing, medical exams, interviews.

- **Measurables are public** — every team sees the same 40 time, bench press,
  vertical jump. No scouting required.
- **Medical evaluations** are shared but your medical staff interprets them. One
  team's "manageable injury risk" is another's "red flag."
- **Interviews** are private. Your scouts conduct interviews with prospects and
  come away with subjective impressions — football IQ, personality, character,
  coachability. These are your data alone.
- **Combine risers and fallers**: A great workout can change a prospect's stock
  league-wide. The question is always: is the workout the truth, or is the game
  tape the truth?

### Pro days (March)

- Individual workouts at the prospect's school
- Controlled environment — prospects can prep specifically for their pro day
- Useful for follow-up on combine concerns or for prospects who didn't test well
  at the combine
- You choose which pro days to attend (scout travel = resources)
- Private workouts can also be arranged for specific prospects — additional cost
  but additional information

### Final evaluation period (March-April)

- All scouting data is in
- Cross-check reports finalize
- You build your final draft board based on everything you've gathered
- Last chance to dispatch scouts for a final look at a prospect you're uncertain
  about
- This is where you synthesize everything: area scout reports, cross-checks,
  combine data, interview impressions, medical, mock draft intel, and your own
  judgment

---

## Media Mock Drafts

Throughout the pre-draft process, media analysts publish mock drafts — public
predictions of who each team will pick. These are a real part of the NFL draft
ecosystem, and they should be a real part of this game.

### What mock drafts are

Mock drafts are published by generated media personalities (analysts, draft
pundits, beat reporters) and predict pick-by-pick how the first round (and
sometimes later rounds) will play out. They're public — every team and every
player can see them.

Each mock draft analyst has their own tendencies:

- **The consensus builder**: Reflects the conventional wisdom. His mocks track
  closely with the aggregate of other mocks. Useful as a baseline for where the
  market stands.
- **The contrarian**: Loves hot takes and surprise picks. Predicts trades and
  reaches that others don't. Sometimes he's ahead of the curve; usually he's
  just wrong. But when he's right, it's dramatic.
- **The insider**: Claims to have sources within front offices. His mocks shift
  based on "what he's hearing." Sometimes this is real signal — leaked team
  interest can move a prospect up or down. Sometimes it's noise.
- **The analytics guy**: Builds his board on production metrics and athletic
  profiles. Dismisses traditional scouting wisdom. His mocks look different from
  the consensus and are occasionally vindicated years later.
- **The beat reporter**: Covers a specific team. His mock predictions for _your_
  team may reflect actual intel from your organization's leaks, or they may be
  pure speculation. His predictions for other teams are usually just guesses.

### How mock drafts are useful to you

**As a signal of public consensus:**

- If three mock drafts all project the same edge rusher to your team, that tells
  you something about how the market perceives your needs — and possibly about
  how other teams expect you to pick
- If a prospect you like is rising in the mocks, other teams are probably
  getting more interested too — you may need to trade up
- If a prospect is falling in the mocks, is the market seeing something you
  missed, or is it groupthink you can exploit?

**As a tool for anticipating other teams:**

- Mocks project what other teams will do. If every mock has the team picking
  ahead of you taking a QB, you can plan around that — but it's not guaranteed
- Mock-projected runs on a position (e.g., "three WRs in the top 10") help you
  estimate scarcity and plan trade strategies

**As entertainment and immersion:**

- Reading mock drafts is fun. It's part of the real NFL draft experience — the
  speculation, the debates, the hot takes
- Seeing a mock project "your guy" to another team creates anxiety. Seeing a
  mock project a reach for your team creates indignation. These emotional
  reactions are the game working.
- Post-draft, you can look back at the mocks and see who the media thought you'd
  pick vs. who you actually picked. "Everyone had us taking the OT at 12 but we
  took the corner. Let's see who was right."

**As a flawed reference your scouts may react to:**

- Some of your scouts (hidden trait) are influenced by media consensus. A
  prospect rising in mock drafts might get a subtle bump in their evaluations —
  not because the prospect changed, but because the scout is affected by the
  buzz. This is a realistic bias: real NFL scouts talk about fighting the
  influence of media hype.
- Other scouts are contrarian by nature — if the media loves a prospect, they
  instinctively look harder for flaws. Also realistic.
- You won't know which of your scouts are media-influenced. You'll discover it
  over time by noticing whose grades seem to track with mock draft movement vs.
  whose grades are independent of it.

### Mock draft cadence

Mocks are published at key moments throughout the pre-draft timeline:

- **Early season (way-too-early mocks)**: Highly speculative, based on college
  production and preseason hype. Fun to read, unreliable.
- **Post-season**: As the college season ends and draft declarations come in,
  mocks get more grounded. The prospect pool is taking shape.
- **Post-combine**: Mocks shift based on combine performance. Risers and fallers
  shake up the projections. This is where "combine bias" shows up in mock drafts
  — analysts overreact to workouts.
- **Post-free-agency**: Team needs shift based on free agency signings. A team
  that signed a top corner in FA no longer needs one in the draft — mocks
  adjust.
- **Draft week (final mocks)**: The most informed and most widely read. These
  reflect the latest intel, rumors, and speculation. They're the closest thing
  to a prediction — and they're still regularly wrong.

### Mock draft accuracy

Mock drafts should be **directionally useful but frequently wrong** — just like
in real life. Over time, you learn:

- Consensus mocks are right about the top 3-5 picks more often than not, but
  accuracy drops fast after that
- Individual mock analysts have track records — some are consistently better
  than others (and you can check their historical accuracy)
- Mocks are worst at predicting trades, which reshape the entire board
- A prospect consistently mocked in the top 10 almost never falls past 20, but
  where exactly he lands within that range is unpredictable

### What mock drafts are NOT

- They are **not your scouting reports**. A mock draft tells you where the media
  thinks a player will go, not how good he actually is. A consensus top-5 pick
  can still be a bust. A projected 3rd-rounder can still be a steal.
- They are **not other teams' draft boards**. NPC teams build their own boards
  based on their AI personality, scheme, and scouting — not based on mock
  drafts. The mock might say the Bears will take the QB, but the Bears' AI might
  love the OT instead.
- They are **not a substitute for your own evaluation**. The mock says your team
  should take the WR at 15. Your scouts say the CB is the better pick. Who do
  you trust — the media or your own people?

---

## What Scouts Get Wrong (and Right)

The scouting system should produce realistic evaluation patterns. Scouts aren't
random number generators — they have systematic strengths and weaknesses.

### Things scouts generally get right

- Physical measurables (these are mostly objective)
- Current skill level of well-scouted prospects
- Obvious scheme fit/misfit
- Evaluating players at "clean" positions — positions where athletic traits
  translate directly to NFL performance (e.g., edge rushers, corners)

### Things scouts often get wrong

- **Projection** — how much a player will improve (or not). The biggest source
  of scouting error. Everyone agrees the prospect is a B+ today. Is he an A in
  two years, or still a B+?
- **Intangibles** — character, work ethic, and football IQ are genuinely hard to
  assess from the outside. A few interviews and background calls aren't enough
  to truly know a person.
- **Scheme translation** — a player dominant in a college spread might not
  translate to a pro-style offense. College production ≠ pro production.
- **Medical risk** — how much a past injury will affect a career is uncertain.
  Medical evaluations are probabilistic, not deterministic.
- **"Ceiling"** — the most overused and least reliable scouting concept. Almost
  every bust was someone's "highest ceiling in the draft."
- **Offensive linemen** — the hardest position to scout. The skills that matter
  (hand placement, footwork, leverage, mental processing) are subtle and hard to
  grade from film.

### Biases you'll discover over time

Since scout attributes are hidden, you learn biases the hard way — by noticing
patterns across multiple drafts where a scout's evaluations consistently diverge
from reality in the same direction:

- A scout who consistently overrates combine warriors (great athletes, mediocre
  football players) — you'll see his top-graded guys share an athletic profile,
  and they'll underperform his grades
- A scout who falls in love with "his guys" and can't objectively re-evaluate —
  his conviction grades are suspiciously high and don't correlate with outcomes
  better than his lukewarm grades
- A scout whose grades for QBs are unreliable but whose OL evaluations are
  excellent — the positional accuracy gap shows up in the data over time
- A scout who undervalues small-school prospects because he's skeptical of the
  competition level — you'll notice his grades for small-school players are
  systematically lower than how those players actually perform

None of this is told to you. You discover it the same way a real GM does: by
paying attention to the track record and connecting the dots yourself.

---

## Scouting Beyond the Draft

Scouting isn't just for draft prospects. You also need information to make other
roster decisions.

### Evaluating trade targets

- How good is the player another GM is offering you?
- Your scouts can evaluate current NFL players too, though with less depth than
  draft prospects (you have game film but not interview access)
- Is this player actually declining, or did he just have a bad year?
- Does he fit your scheme? Your scout's assessment matters here.

### Free agency evaluation

- Before free agency opens, you should be scouting the pending free agent class
- How good are these players really? Are they declining?
- Will they fit your scheme?
- What's their injury risk going forward?
- This scouting competes for the same budget as draft scouting — how much do you
  allocate to each?

### Opponent evaluation

- Your coaching staff studies opponents for game planning, but your scouts can
  provide personnel evaluations that inform game plans
- "Their left tackle has been struggling with speed rushers all season" — a
  scout who watches that team's games might notice what the box score doesn't
  show

### Resource allocation across scouting missions

This creates a fundamental budget decision each year:

- **Draft scouting**: The primary mission, consuming the bulk of your budget
- **Trade target evaluation**: Important when you're active in the trade market
  — but takes points away from draft scouting
- **Free agency evaluation**: Important in the weeks before free agency opens
- **Opponent scouting**: Low priority for a GM (coaching staff handles most of
  this) but can provide an edge

How you split your scouting resources across these missions is another layer of
strategic decision-making.

---

## The Multi-Year Feedback Loop

This is what transforms scouting from a one-time mini-game into the deepest
system in the franchise sim.

### Retrospective tools

After each season, you can review:

- **Draft class report card**: How is each pick performing relative to where you
  drafted them? Relative to your pre-draft grade?
- **Scouting accuracy**: Compare your scouts' pre-draft evaluations to actual
  player performance. Which scouts were right? Which were wrong? On which
  positions?
- **Board vs. reality**: You had Player X in Tier 3. He's now an All-Pro. Your
  scout gave him a B+. The actual grade was an A+. What happened? Was the scout
  wrong, or did the player develop beyond expectations?
- **Hit rate by round**: What percentage of your picks in each round became
  starters? Contributors? Busts?
- **Positional accuracy**: Are you better at drafting WRs than OL? The data
  accumulates over years.
- **Scout track record**: Over 5 drafts, Scout A has correctly identified 70% of
  starters in his region. Scout B is at 45%. This is actionable information for
  future scouting allocation.

### Learning your scouts

This is the payoff of the hidden scout attributes system. Since you can't see a
scout's accuracy or biases directly, the retrospective tools are how you
_discover_ them through observation — the same way a real GM evaluates his
scouting staff.

The data the retrospective tools surface is raw — it doesn't tell you "this
scout has a speed bias." It shows you: "Here are the 12 prospects Scout A
evaluated over 3 years, here's what he said, and here's what actually happened."
You draw the conclusions:

- **Reliability by position**: "My ACC guy graded 8 defensive linemen. 6
  performed within a tier of his grade. He graded 5 QBs. Only 1 landed close."
  You now know something his resume didn't tell you.
- **Bias discovery**: "Scout C's top 3 guys over three years were all combine
  freaks. All three busted. Meanwhile, the polished route-runner he gave a B- is
  now a Pro Bowler." You're seeing a pattern — he's wowed by athleticism and
  underweights technique.
- **Trust calibration**: You don't fire a scout for one miss. But after 3
  drafts, if the data says he's consistently wrong on a position group, you
  either stop using him for that position or replace him. And if the data says
  he's elite at evaluating OL? Send him to every OL pro day you can.
- **Confidence calibration**: "When this scout says he's sure, he's usually
  right. When he hedges, it's a coin flip." Some scouts are well-calibrated;
  others are overconfident or underconfident. This takes years to learn.

The game never tells you "Scout A has 82 accuracy for DL." It gives you the
evidence and lets you be the GM. Your ability to read that evidence and act on
it IS the skill expression.

### Organizational scouting philosophy

Over time, you develop an organizational identity around scouting:

- Do you trust the combine or the tape?
- Do you prioritize physical traits or production?
- Do you value character heavily or dismiss it?
- Do you invest in deep dives on a few targets or cast a wide net?
- Do you spend on expensive scouts or invest in infrastructure and analytics?
- Do you rely heavily on cross-checks, or trust your area scouts' initial reads?

There's no "correct" answer. Different approaches work in different situations.
A GM who prioritizes athleticism will find different steals and make different
mistakes than one who prioritizes technique. The game should support multiple
valid scouting philosophies — and the retrospective tools should help you refine
your approach over time based on actual results.

---

## League Genesis

This document describes scouting in a mature Zone Blitz league. In a brand-new
genesis league, scouting starts from zero — no accuracy track record, no
long-tenured scouts, no prior draft classes to calibrate against. See
[League Genesis](./league-genesis.md) for the full context; the scouting-
specific points:

- **Scouts are generated uniquely per league.** Same rule as coaches — the
  entire scouting universe is generated at league creation and never shared
  across save files. The scouts you hire at founding are one-of-one evaluators
  whose careers will only play out in this league.
- **Genesis hiring is contested.** Scouts are part of the same shared candidate
  pool as coaches and are hired in parallel across all franchises. See
  [Coaches — League Genesis](./coaches.md#league-genesis) for how the bidding
  works.
- **Year 1 scouting covers the founding player pool.** The first evaluation work
  your scouts do is on the veteran pool heading into the allocation draft — an
  unusual pool of archetypes (raw college athletes, practice- squad journeymen,
  back-end vets, middling pros) that no scouting methodology has ever calibrated
  against. Gems and busts are more frequent here than in any later evaluation
  cycle. The scouting window between founding pool generation and the allocation
  draft is a dedicated multi-week phase.
- **The first rookie-class scouting cycle runs through Year 1.** While the
  league is playing its inaugural season, your scouts are evaluating the rookie
  class that will be drafted in the Year 2 offseason — the first true rookie
  draft in league history. Scouting department investment made during genesis
  hiring directly shapes the quality of those reports.

Scouting is fun because it's a **skill you develop as a player**, not just a
system you optimize. In year 1, you're guessing. By year 5, you've learned which
scouts to trust, how to read conflicting reports, when to go deep vs. cast a
wide net, and where your organizational blind spots are.

The best scouting moments:

- "My scout had this guy as a 3rd rounder but he was an All-Pro last season. I
  need to figure out why my evaluation was wrong — was it the scout, the
  scouting depth, or did the player just develop unexpectedly?"
- "I've nailed my last three 2nd-round picks. My process for evaluating
  mid-round WRs is working. Time to invest more scouting resources there."
- "I fired my eastern scout because his grades were consistently wrong on
  linebackers. The new guy already identified a small-school edge rusher that
  the old scout would have missed."
- "Two scouts disagree violently about this QB. One says franchise player, the
  other says career backup. I know Scout A overrates arm strength and Scout B is
  conservative on QBs. The truth is probably in between — a solid starter, not a
  franchise player. I'll draft him in the 2nd, not the 1st."
- "I spent my entire deep-dive budget on three prospects. Two of them are
  exactly as advertised. The third has a character concern that nobody else
  knows about. I'm passing, and I'll watch another team learn the hard way."

The deepest satisfaction comes not from any single great evaluation, but from
building a scouting process that consistently finds edges — and having the data
to prove it works.
