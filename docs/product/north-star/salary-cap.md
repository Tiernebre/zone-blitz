# Salary Cap Management

The salary cap is the central constraint of the entire game. Every roster
decision — drafting, trading, free agency, re-signing, cutting — runs through
the cap. It turns team-building from "collect the best players" into a
multi-year resource-allocation puzzle where structure, timing, and planning
matter as much as talent evaluation.

## Design Philosophy

Two GMs with identical cap space can construct wildly different rosters based on
how they structure contracts. One goes all-in with front-loaded deals and void
years to create a two-year championship window. The other builds sustainably
with moderate contracts and keeps future flexibility. Both are valid strategies
with real tradeoffs that play out over seasons.

The cap system should reward forward-thinking GMs and punish short-term
thinking. Going all-in with restructures and void years can create a
championship window — and a brutal cap hell when the bill comes due. The game
should make both the thrill of the window and the pain of the hangover feel
real.

---

## Core Cap Mechanics

### The hard cap

- Every team has the same salary ceiling — no luxury tax, no soft cap, no
  exceptions. You're over or you're under.
- **Salary floor**: A minimum spending requirement prevents tanking through
  austerity. Teams that don't meet the floor must pay the difference to their
  players. This ensures that even rebuilding teams invest in talent.
- **Cap compliance deadline**: Teams must be cap-compliant at specific points in
  the calendar (start of the league year, final roster cuts). You can be over
  the cap during the offseason as long as you get under by the deadline.

### Cap growth

- The cap grows year over year, reflecting league revenue growth
- The growth rate is configurable per league (commissioners can set a fixed
  percentage, a random range, or tie it to league performance metrics)
- Cap growth affects long-term planning — a contract that feels huge today may
  look reasonable in three years as the cap rises
- Smart GMs factor projected cap growth into contract structures. Locking up a
  player at today's rate becomes a bargain as the cap inflates around it.

### Cap rollover

- Unused cap space carries over to the next year
- This creates a strategic lever: deliberately underspend in a down year to
  create a war chest for a future free agency class or extension window
- Rollover is cumulative — multiple years of prudent spending can give you a
  massive one-year advantage
- "Developer" type GMs in rebuild mode should actively accumulate rollover as
  part of their strategy

---

## Contract Structure

Contracts are the tools you use to manage the cap. The total dollar amount
matters, but _how_ you distribute those dollars across years and categories is
where the real strategy lives.

### Base salary

- Counts fully against the cap in the year it's paid
- The simplest component — what the player earns that season
- Non-guaranteed base salary can be eliminated by cutting the player (no cap hit
  beyond dead cap from bonuses)

### Signing bonus

- A lump-sum payment at signing, but **prorated equally across the life of the
  contract** for cap purposes (up to 5 years maximum proration)
- The primary tool for manipulating cap hits: a $25M signing bonus on a 5-year
  deal only counts $5M/year against the cap
- If the player is cut or traded before the contract expires, all remaining
  prorated bonus accelerates onto the current year's cap as **dead cap**
- This is the fundamental tension: signing bonuses create short-term relief and
  long-term risk

### Guaranteed money

- The total the player is guaranteed regardless of performance, injury, or cuts
- **Fully guaranteed**: Paid no matter what — the player's security
- **Guaranteed for injury only**: Paid if the player is injured but can be
  voided if cut while healthy
- **Rolling guarantees**: Become fully guaranteed on a specific date (e.g.,
  "Year 3 base salary becomes guaranteed on the 3rd league day of Year 2")
- Guaranteed money is what players and their agents care about most. It's the
  real value of a contract, not the headline number.

### Roster bonus

- Paid (and counted against the cap) when the player is on the roster at a
  specific date
- Functions like a soft team option — if you cut the player before the roster
  bonus date, you avoid the payment
- Often used to create natural decision points: "We'll evaluate his performance
  through Year 2, and the Year 3 roster bonus forces us to commit or move on"

### Option bonuses

- A bonus the team can choose to exercise at a specific date
- If exercised, the bonus is typically prorated like a signing bonus across the
  remaining contract years
- If declined, the contract may void or continue at a reduced rate
- Creates flexibility: the team isn't locked into paying the bonus, but the
  player gets a guaranteed payday if the team exercises it

### Incentives

- Performance-based bonuses tied to specific statistical or team achievements
- **Likely to be earned (LTBE)**: Based on previous-year performance, the player
  is statistically likely to hit the threshold. Counts against the current
  year's cap.
- **Not likely to be earned (NLTBE)**: Player is unlikely to hit the threshold
  based on last year. Does NOT count against the current cap — but if the player
  earns them, the bonus hits _next year's_ cap.
- This distinction creates interesting planning scenarios: loading a contract
  with NLTBE incentives keeps the current cap clean, but a breakout season
  creates a surprise cap hit the following year

### Void years

- Years added to a contract solely to spread out a signing bonus's cap
  proration. The player won't actually play during these years.
- Example: A 2-year contract with 3 void years allows a signing bonus to be
  prorated over 5 years instead of 2 — dramatically reducing the per-year cap
  hit during the real contract years
- When the void years activate, the remaining prorated bonus accelerates as dead
  cap
- Useful for short-term cap relief; creates future dead cap that limits
  flexibility
- The game should make void year consequences clearly visible in cap projections
  so players understand the tradeoff they're making

### Case study: the gimmick contract (Taysom Hill)

The most extreme use of the tools above is the **gimmick contract** — a deal
whose reported headline dollars bear almost no resemblance to the dollars that
ever hit the cap or the player's bank account. Cap-Hell teams reach for the
gimmick contract when the league-year deadline is looming and they still need to
sign a useful player without the cap space to make a real offer. The player gets
a headline "X-year, $Yzillion" press release that makes them sound like a star.
The GM gets a one-year rental with a small real guarantee. The fan base sees "we
signed a blockbuster deal" until they read past the lede.

The canonical example is the **Taysom Hill 4-year, $140M contract** the New
Orleans Saints signed in 2021. Hill was a converted quarterback / utility player
— genuinely useful, nowhere near a $35M-per-year franchise player. The Saints
were badly over the cap. The structure was: a small 2021 base salary, a 2021
per-game roster bonus, and three **void years** (2022, 2023, 2024) that were
never meant to be played. On top of that, a huge **option bonus** was declared
for an early league-year exercise — the figure the press multiplied into the
$140M headline — that the team would let expire. In practice the deal was **one
real year at roughly $10M**. Everything past 2021 was accounting fiction whose
job was to make the headline look like a superstar signing.

This is why the cap engine computes two separate numbers:

- **Headline value** sums every theoretical dollar the deal could pay out —
  base, signing bonus, workout and roster bonuses, the season max on any
  per-game roster bonuses, and the face amount of every declared option bonus as
  if the team intends to exercise it. This is the number the media reports, the
  agent quotes, and the morale system reads. Headline is _optimistic by
  construction_; it is what the deal looks like in the best possible light.
- **Cap hit** records only what the deal actually charges against the cap this
  year: real base, real bonuses earned, prorated signing-bonus slices, and
  exercised options. Unexercised options contribute nothing. Void years
  contribute only signing-bonus proration, not real money.

**The divergence between those two numbers is part of the game feel.** The press
announces a blockbuster. The fans expect a star. The cap sheet shows the GM got
a one-year rental at a discount, a reputational victory, and a tiny future
dead-cap tail. Two seasons later the void years activate, the accelerated
proration hits, the fans notice the player is gone, and the story completes
itself. A league full of gimmick deals is the signature sound of Cap Hell — a
lot of noise in the press, a lot of short-term rentals on the field, a lot of
bills coming due on the same day three years from now.

---

## Cap Manipulation Tools

Managing the cap is an active, ongoing skill — not something you set and forget.

### Restructuring contracts

- Convert a player's base salary into a signing bonus
- This reduces the current-year cap hit (spreading the money over remaining
  contract years) but increases future-year cap hits
- Can only restructure with the player's consent (players almost always agree
  because they get the money upfront as a lump sum instead of spread across game
  checks)
- The classic "kicking the can down the road" — provides immediate relief at the
  cost of future flexibility
- Teams in championship windows restructure aggressively. Teams about to enter a
  rebuild should almost never restructure.

### Extensions

- Adding years to an existing contract, typically with new money
- Reduces per-year cap hit by spreading costs over a longer period
- Often combined with new guarantees as an incentive for the player to agree
- A well-timed extension can lock up a star player before their market value
  spikes and smooth out your cap outlook for years

### Post-June 1 designations

- When cutting a player, you can designate the release as a "post-June 1" cut
- Instead of all dead cap accelerating onto the current year, it's spread across
  two years: the current year absorbs only the current year's prorated amount,
  and next year absorbs the rest
- Limited to two post-June 1 designations per team per year
- Critical tool for teams trying to get out from under bad contracts while
  maintaining current-year competitiveness

### Contract renegotiation (pay cuts)

- Ask a player to take a reduced salary
- Players may agree if the alternative is being cut, especially veterans who
  want to stay with a contender
- Player personality affects willingness: players with high loyalty are more
  likely to accept; players with high greed almost never will
- Success rate depends on the player's market — if they'd get more elsewhere,
  why would they take less?

---

## The Cap and the Draft

The draft is the most cap-efficient way to acquire talent, and the cap system is
designed to reinforce this.

### Rookie wage scale

- Drafted players sign contracts with slotted values based on draft position
- Higher picks get larger contracts, but even the #1 overall pick is cheap
  relative to a veteran free agent of similar ability
- Rookie contracts are fully slotted — there's no negotiation on the total value
  (unlike real-world holdouts of the past)
- The rookie pool is a fixed total that comes from the team's cap — teams with
  more picks have a slightly larger rookie pool obligation

### The rookie cost advantage

- A first-round pick who develops into a star is playing at a fraction of his
  market value for 4-5 years. This cost advantage is the foundation of roster
  construction.
- The "rookie window" — the period where you have multiple cheap contributors on
  rookie deals — is the optimal time to spend aggressively elsewhere on the
  roster to build a contender
- Smart GMs stagger their draft classes so rookie windows overlap, maintaining
  cost-efficient contributors at multiple positions simultaneously

### Fifth-year option

- First-round picks have a fifth-year team option
- The option salary is set by position (projected top-10 salary at the position
  for options exercised on top-10 picks, projected 11-25 for others)
- Must decide by the end of the player's third season whether to exercise
- Exercising the option guarantees the salary for injury, and it becomes fully
  guaranteed at the start of the player's fourth season
- For a star player, the fifth-year option is still a below-market bargain. For
  a bust, it's an overpay you're stuck with for a year.

### UDFA budget

- Separate signing bonus budget for undrafted free agents (does not count
  against the main cap)
- UDFA contracts are minimum-salary deals with small signing bonuses
- The UDFA pool is the one area where draft spending is somewhat flexible — you
  can allocate more bonus money to UDFAs you really want

### Cap implications of draft-day trades

- Trading picks doesn't directly affect your cap, but it changes your rookie
  pool obligation
- Trading up means absorbing a higher-slotted rookie contract
- Trading down reduces your rookie pool obligation, freeing a small amount of
  cap space
- Trading future picks has no immediate cap impact but affects future rookie
  pool obligations
- A team trading away all its high picks has minimal rookie pool costs — more
  room for veteran spending, but no cost-efficient young talent pipeline

---

## The Cap and Free Agency

Free agency is where cap management becomes most visible and consequential.

### Cap space as currency

- Available cap space determines how aggressively you can pursue free agents
- Teams over the cap must cut or restructure before signing anyone
- Teams with significant cap space have a structural advantage: they can absorb
  contracts other teams can't afford, and they can offer more guaranteed money

### Contract structure as strategy

Different structures serve different team strategies:

- **Front-loaded deals**: High early-year cap hits, lower later years. Good for
  teams with current cap space who want future flexibility. Players like them
  because they get paid sooner.
- **Back-loaded deals**: Low early-year cap hits that escalate. Creates current
  cap space but commits future dollars. The "spend now, pay later" approach.
- **Void-year deals**: Spread signing bonus over phantom years to minimize
  real-year cap hits. Maximum short-term relief, maximum long-term dead cap
  risk.
- **Incentive-laden deals**: Keep the guaranteed base low and add NLTBE
  incentives. Reduces cap risk but may be less attractive to players who want
  security.

### Dead cap from free agency

- When you cut a player you signed in free agency, all remaining prorated
  signing bonus accelerates as dead cap
- The bigger and longer the original deal, the worse the dead cap if it goes
  wrong
- "Bad contracts" aren't just about overpaying — they're about the dead cap that
  lingers after you admit the mistake
- The game should track and display dead cap projections clearly so GMs can see
  the consequences of their decisions before they make them

### The franchise tag and cap impact

- The franchise tag is one of the most expensive single-year cap charges a team
  can carry
- Tag value is calculated as the average of the top-5 salaries at the position
  (or 120% of the player's prior-year salary, whichever is greater)
- Using the tag on a premium position (QB, edge, WR) can consume 15-20% of your
  total cap
- The transition tag is cheaper but offers less retention certainty
- Tag strategy interacts with long-term cap planning: do you eat the tag hit
  this year to buy time for an extension, or let the player walk and recoup a
  compensatory pick?

### Compensatory pick formula

- The comp pick system rewards teams that lose more valuable free agents than
  they sign
- Comp picks are awarded based on the contract value and playing time of
  departing vs. arriving free agents
- This creates a deliberate strategy: let expensive veterans walk, sign minimal
  free agents, and harvest 3rd-through-7th round compensatory picks
- "Developer" GMs can systematically exploit this — draft well, develop players,
  let them walk in free agency, collect comp picks, repeat

---

## The Cap and Trading

Every trade has cap implications. Understanding them is the difference between a
roster-building move and a cap disaster.

### Absorbing contracts in trades

- The acquiring team must have enough cap space to absorb the traded player's
  remaining base salary for the current year
- Signing bonus proration does NOT transfer — the original team retains the
  remaining prorated bonus as dead cap
- This means trading away a player with a large signing bonus creates dead cap
  for the trading team, while the acquiring team only absorbs the base salary
  and roster bonuses

### Trading as cap relief

- Teams can trade players specifically to shed salary
- A team in cap hell might attach a draft pick to a bad contract to entice
  another team to take it: "I'll give you a 3rd round pick if you take this
  $15M/year contract off my hands"
- Teams with cap space can exploit this — absorb bad contracts in exchange for
  draft capital. It's the cap equivalent of buying low.
- "Cap dump" trades are a legitimate and important part of the trade market

### Dead cap from trades

- When you trade a player, any remaining prorated signing bonus accelerates as
  dead cap (same as cutting, unless post-June 1 designated)
- This means trading a recently-signed player with a big signing bonus is
  extremely expensive in dead cap — you're eating years of prorated bonus in one
  shot
- Teams need to factor dead cap into trade evaluations: the player you're
  getting might be great, but if trading the outgoing player creates $12M in
  dead cap, the real cost is much higher than it appears

### Salary matching in trades

- For teams over the cap or close to it, trades may require salary to flow both
  ways to make the math work
- "Salary dumps" and "salary swaps" are common: a contender sends a pick for a
  rental player but needs to include a salary-matching piece going back
- Multi-player trades sometimes happen purely because of cap math, not talent
  evaluation

### Trade deadline cap dynamics

- Contenders at the deadline often have limited cap space — they've been
  spending to compete
- Sellers at the deadline want to shed salary for the current year and receive
  future assets
- This creates a natural market: buyers acquire talent but absorb salary,
  sellers sacrifice talent but gain cap relief and picks
- Rental players (expiring contracts) are attractive deadline acquisitions
  because the cap commitment is short-term

---

## Cap Projections and Planning

The game should provide robust tools for planning your cap future.

### Multi-year cap outlook

- Project your cap situation 3-5 years into the future
- Shows committed spending (existing contracts), projected cap growth, estimated
  costs of upcoming extensions, and available space
- Highlights "cliff years" where dead cap spikes or multiple contracts expire
  simultaneously
- Essential for deciding whether to restructure, extend, or let players walk

### Scenario modeling

- "What if" tools for cap planning:
  - "What if I cut Player X?" → shows dead cap impact and cap savings
  - "What if I restructure Player Y's contract?" → shows current-year savings
    and future-year cost
  - "What if I extend Player Z for 4 years at $20M/year with $40M guaranteed?" →
    shows the full cap projection with the new deal
  - "What if I sign Free Agent A to this offer sheet?" → shows how it fits into
    the current and future cap picture
- Multiple scenarios can be saved and compared side-by-side
- This is where the spreadsheet-GM fantasy lives — the player who loves
  optimizing cap structures should have powerful, satisfying tools

### Cap alerts and warnings

- Warnings when approaching the cap ceiling
- Alerts for upcoming roster bonus dates (decision points)
- Notifications when rolling guarantees are about to vest
- Reminders about fifth-year option deadlines
- Dead cap projections that highlight future pain points

---

## Cap Health Indicators

The game should give GMs a sense of their overall cap health, not just the
current number.

### Flexibility score

- A composite measure of how much room a team has to maneuver
- Factors: available cap space, percentage of cap committed to guaranteed money,
  dead cap obligations, number of players needing extensions soon
- Not a single number shown to the player — instead, qualitative indicators:
  "healthy," "tight," "inflexible," "cap hell"
- Relative to the league: being $5M under the cap means different things in a
  league where the average team has $20M in space vs. one where everyone is
  tight

### Championship window vs. cap window

- The game should surface the tension between competitive readiness and cap
  health
- A team with a great roster but no cap space is in "win now or suffer" mode
- A team with lots of cap space but a weak roster is positioned to build
- The best-run teams align their championship window (roster talent) with their
  cap window (financial flexibility to supplement through free agency and
  trades)

---

## NPC Cap Management

AI-controlled teams must manage the cap realistically to keep the league feeling
authentic.

### Personality-driven cap strategies

- **"Win Now" GMs**: Spend to the cap ceiling. Restructure aggressively. Use
  void years. Front-load guaranteed money. Create championship windows at the
  cost of future flexibility. Occasional cap hell.
- **"Developer" GMs**: Stay under the cap. Accumulate rollover. Let expensive
  veterans walk for comp picks. Spend primarily on extensions for their own
  drafted players. Rarely make splashy free agent signings.
- **"Moneyball" GMs**: Exploit inefficiencies. Target players other teams cut
  for cap reasons. Structure incentive-heavy deals. Take on bad contracts for
  draft pick compensation. Always have cap space because they rarely overpay.
- **"Old School" GMs**: Pay "their guys" — sometimes overpay for loyalty. Less
  sophisticated with contract structure. Occasionally get into cap trouble
  through emotional decisions rather than strategic ones.
- **"Gambler" GMs** _(rare)_: The most reckless cap managers in the league.
  Restructure everything, use void years liberally, and hand out massive
  guaranteed deals to chase a championship _right now_. They cycle between
  championship windows and brutal cap hell faster than any other archetype. When
  a Gambler hits cap hell, they become a fire sale — other GMs can scoop up
  talent shed for cap reasons.

### NPC cap mistakes

- AI teams should occasionally make suboptimal cap decisions (as real teams do)
- Overpaying a mediocre player in free agency because of positional scarcity
- Restructuring too aggressively and creating future cap problems
- Holding onto an aging veteran's contract too long out of loyalty
- These mistakes create opportunities for human GMs to exploit — trade for cap
  casualties, sign players cut for financial reasons, target NPC teams desperate
  to shed salary

---

## League Setup

The cap and contract structure described above applies to a mature Zone Blitz
league. A brand-new league operates under a deliberately compressed economic
regime that evolves as the league proves itself. See
[League Setup](./league-setup.md) for the full vision; the cap-specific points:

- **Early-league economics are flat.** For the first several seasons, contracts
  are short, guaranteed money is modest, and no class of mega-deals distorts the
  market. A young league has no television contract funding record-setting cap
  growth, players are taking bets on an unproven institution, and no one has
  accumulated the leverage that produces franchise-defining deals.
- **The starting cap is level.** Every franchise enters Year 1 with the same cap
  space. The allocation draft and initial free agency are the only moment in
  league history when the financial playing field is perfectly even.
- **The cap curve bends upward as the league matures.** Free-agency cycles
  produce stars with real leverage. Expansion and media interest grow league
  revenue. The cap itself grows with them, and a generation of football in
  produces the league's first genuinely franchise-defining contracts — moments
  that matter precisely because the player's career was built entirely inside
  this league's record.
- **Non-cap spending still applies.** Facilities, scouting department size,
  analytics infrastructure — all of it is funded outside the cap and differs by
  market and operator choice, exactly as in a mature league.

---

## What Makes Cap Management Fun

Cap management is fun when it creates **meaningful strategic choices with
long-term consequences**.

The best cap moments:

- "I can sign this star free agent, but I'd have to restructure two contracts
  and I know I'll need that cap space in two years for my QB extension."
- "I'm in cap hell but my roster is stacked. If we don't win this year, the next
  three years are going to be painful."
- "That team just cut a Pro Bowler because they couldn't afford him. I've been
  accumulating rollover for exactly this moment."
- "I structured my QB's contract with void years to open a three-year window.
  Year one: made the conference championship. Year two starts now. The clock is
  ticking."
- "I traded a 3rd to absorb a bad contract, and the player I got actually turned
  into a solid starter. Cap arbitrage at its finest."
- "My rival just signed three big free agents. I'll just sit here with my comp
  picks and cap space, watching them mortgage their future."
