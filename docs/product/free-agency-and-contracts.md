# Free Agency & Contracts

Free agency is the other half of team-building, and it should feel
fundamentally different from trading. Trading is a negotiation between two
parties. Free agency is a blind auction — you're bidding against 31 other teams
and you can't see their offers.

## Design Philosophy

The salary cap turns free agency from "sign the best players" into a
resource-allocation puzzle. Every dollar matters. Two GMs with identical cap
space can construct wildly different rosters based on how they structure
contracts. One goes all-in with front-loaded deals; the other builds
sustainably with moderate contracts. Both are valid strategies with real
tradeoffs that play out over years.

## The Salary Cap

The cap is the central constraint of roster construction. It creates scarcity,
forces tradeoffs, and rewards planning.

### Cap mechanics

- Hard salary cap — every team has the same ceiling
- Salary floor — minimum spending requirement to prevent tanking through
  austerity
- Cap carries over — unused cap space rolls into the next year
- Cap grows over time — reflecting league revenue growth (configurable per
  league)

### Contract structure

Contracts are the tools you use to manage the cap. Structure matters as much
as total value:

- **Base salary**: Counts fully against the cap in the year it's paid
- **Signing bonus**: Prorated equally across the life of the contract (up to 5
  years). Great for pushing cap hits into the future.
- **Guaranteed money**: The total the player is guaranteed regardless of
  performance or cuts. This is what players care about most.
- **Roster bonus**: Paid (and counted against cap) when the player is on the
  roster at a specific date
- **Incentives**: Performance-based bonuses. "Likely to be earned" count
  against the current cap; "not likely to be earned" count against next year's
  cap if earned.
- **Void years**: Years added to a contract solely to spread out a signing
  bonus's cap hit. The player won't actually play those years — the cap hit
  just gets pushed further out. Useful for short-term relief, creates future
  dead cap.

### Cap gymnastics

Managing the cap is a skill:

- **Restructuring**: Convert base salary to signing bonus to free up current-
  year space (at the cost of future cap hits)
- **Post-June 1 designation**: Spreading dead cap from a cut over two years
  instead of one
- **Contract extensions**: Adding years to reduce per-year cap hit
- **Dead cap**: The remaining prorated bonus money owed to a player you cut
  or trade. This is the hangover from aggressive cap management.

The cap system should reward forward-thinking GMs and punish short-term
thinking. Going all-in with restructures and void years can create a
championship window — and a brutal cap hell when the bill comes due.

## Free Agency Periods

### Legal Tampering Window

Before free agency officially opens:

- Teams can negotiate with pending free agents
- No deals can be signed yet — just conversations
- In multiplayer, this is when human GMs can DM free agents' representatives
  (or other human GMs for sign-and-trade discussions)
- Builds anticipation: you know which players are likely to hit the market

### Free Agency Opens

The main event:

- **Blind bidding**: You submit contract offers without seeing what other teams
  are offering. You're guessing at the market.
- **Staggered resolution**: Top-tier free agents decide first (within hours),
  mid-tier take a day or two, lower-tier can linger for weeks
- **Opening frenzy**: The first wave of signings happens fast. If you're not
  decisive, players are gone.
- **Market correction**: After the initial frenzy, remaining players become
  bargains as supply exceeds demand

### Mid-Season Free Agency

The street free agent pool:

- Players cut during roster cuts (53-man deadline)
- Players released mid-season (injury replacements, underperformers)
- Available for signing at any time during the season
- Typically lower-tier players, but occasional gems (veteran cut for cap
  reasons)

### Practice Squad Poaching

- Other teams can sign your practice squad players to their active roster
- You get a chance to match by promoting them to your own active roster
- Creates a tension: develop players on the practice squad, but risk losing
  them

### Undrafted Free Agent (UDFA) Period

After the draft:

- Undrafted prospects sign as free agents
- Low-cost contracts, high upside potential
- A well-scouted UDFA can be a roster steal
- Competition for the best UDFAs is real — not every undrafted player goes
  unclaimed

## Player Decision Model

Players aren't just chasing dollars. Their decision weighs multiple factors:

### Money

- **Total contract value**: The headline number
- **Guaranteed money**: What matters most — this is the player's security
- **Average per year**: For comparing offers of different lengths

### Fit and role

- **Scheme fit**: A player who thrived in Cover 3 may prefer a team that runs
  it over one that plays man-heavy, even for less money
- **Role**: Starter vs. backup. A veteran WR2 might take less to be a WR1
  elsewhere.
- **Playing time**: Young players especially want to play

### Team situation

- **Competitiveness**: Ring chasers take discounts to join contenders. This is
  more common with veterans who've been paid already.
- **Win projection**: Players have a sense of which teams are trending up
  vs. down

### Player personality

Players have personality traits that bias their decisions:

- **Money-motivated**: Will almost always go to the highest bidder
- **Ring chaser**: Prioritizes competitiveness, especially later in career
- **Loyalty-driven**: Gives a discount to re-sign with their current team
- **Market-driven**: Values the "brand" of playing for a big-market team
- **Scheme-loyal**: Strongly prefers familiar systems

This means you can "win" a free agent without the highest bid — if your team,
scheme, and situation are attractive. That makes team-building holistic, not
just a salary cap spreadsheet.

## Re-Signing Your Own Players

Before free agency, you can negotiate extensions with your own players:

- Players give a "hometown discount" (varies by loyalty personality)
- Exclusive negotiating window before other teams can talk to them
- Franchise tag and transition tag as retention tools:
  - **Franchise tag**: Guarantees a one-year deal at the top-5 positional
    salary average. Expensive but retains the player. Can only tag one
    player per year.
  - **Transition tag**: Lower guaranteed salary, but other teams can make
    offers and you have right of first refusal

## Compensatory Picks

Losing free agents to other teams earns compensatory draft picks:

- Based on the quality and contract size of departing vs. arriving free agents
- Picks awarded in the 3rd through 7th rounds
- Creates a strategic lever: deliberately let expensive veterans walk, collect
  comp picks, reload through the draft
- "Developer" type GMs can exploit this systematically

## NPC Free Agency Behavior

AI GMs approach free agency according to their personality:

- **"Win Now" GMs**: Spend aggressively in the opening frenzy on marquee
  players. Overpay for proven talent. Front-load deals.
- **"Moneyball" GMs**: Wait for the market to cool. Target undervalued players
  in the second wave. Structure team-friendly deals with incentives.
- **"Developer" GMs**: Prioritize re-signing their own players. Spend minimally
  in free agency. Let expensive veterans walk and collect comp picks.
- **"Old School" GMs**: Value toughness and character. Overpay for "their type"
  of player. Avoid paying premium for finesse positions.

NPC teams get into bidding wars with each other. The market should feel alive —
you're not the only one trying to sign the top corner.

## Multiplayer Dynamics

- All human GMs submit bids during the same window — simultaneous resolution
  prevents first-mover advantage
- You can see who signed where after the fact, but never see competing bids
- The legal tampering window enables human-to-human negotiation for
  sign-and-trade deals
- League chat blows up during the free agency frenzy — trash talk, gloating
  over steals, lamenting missed targets
