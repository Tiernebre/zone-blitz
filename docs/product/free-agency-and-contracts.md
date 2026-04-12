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

The salary cap is the central constraint that makes free agency a
resource-allocation puzzle rather than a shopping spree. For the full cap
system — mechanics, contract structure, cap manipulation tools, and how the cap
interacts with drafting, trading, and free agency — see the dedicated
[Salary Cap Management](./salary-cap.md) document.

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

Every player has hidden personality traits — greed, loyalty, ambition, vanity,
scheme attachment, and media sensitivity — that bias their free agency
decisions. See [Player Attributes — Personality](./player-attributes.md#personality-traits)
for the full trait definitions.

The key traits for free agency:

- **Greed** drives how heavily money weighs against other factors
- **Loyalty** determines whether a player gives a discount to re-sign
- **Ambition** makes veterans chase contenders, even for less money
- **Vanity** pulls players toward big-market teams and the spotlight
- **Scheme attachment** biases players toward teams running familiar systems

This means you can "win" a free agent without the highest bid — if your team,
scheme, and situation are attractive. That makes team-building holistic, not
just a salary cap spreadsheet.

## Re-Signing Your Own Players

Before free agency, you get an exclusive negotiating window with your own
pending free agents. But re-signing isn't automatic — a player's willingness
depends on how they feel about your organization.

### Player-team relationship

Every player has a **morale** toward their current team that evolves over the
course of their tenure. It reflects how they feel about their experience — not
just winning, but their role, usage, and how they've been treated.

Factors that build morale:

- **Winning**: Players on competitive, playoff-caliber teams are happier
- **Role and usage**: A player who's been a featured starter feels valued. A
  player buried on the bench or misused in a scheme that doesn't fit them
  feels undervalued.
- **Team culture**: Organizations that develop players, keep a stable coaching
  staff, and build a positive locker room earn goodwill over time
- **Contract history**: Players remember if you extended them fairly in the
  past or if you let them play out a below-market deal without renegotiating

Factors that damage morale:

- **Being benched or demoted** without a clear performance reason
- **Scheme changes** that marginalize the player's skillset (e.g., switching
  to a system where their position is devalued)
- **Failed negotiations**: Lowball offers or prolonged holdouts sour the
  relationship
- **Franchise tag overuse**: Tagging a player — especially multiple years in a
  row — signals that you want to control them cheaply rather than commit
  long-term. Most players resent it.
- **Losing culture**: Repeated losing seasons with no visible plan erode
  confidence in the organization

### Burnt bridges

When morale drops low enough, the relationship is **burnt**. A player with a
burnt bridge will not re-sign with your team under any circumstances — they
want out, full stop. They'll test free agency and sign elsewhere, even for
less money.

Bridges don't burn overnight. It takes sustained mistreatment or a single
egregious act (like publicly shopping a franchise player in trade talks that
leak). Once burnt, a bridge is extremely difficult to repair — it may take a
coaching change, front office turnover, or years of separation before a player
would consider returning.

### Hometown discounts

Hometown discounts are **uncommon, not the default**. A player taking less
than market value to stay requires a specific combination of factors:

- **Team success**: The team is a contender or clearly trending upward. No one
  takes a discount to stay on a rebuilding team.
- **Strong culture**: The organization has built a reputation for treating
  players well — good coaching, honest front office, player-friendly culture
- **Personal fit**: The player feels valued in their role and believes the
  scheme maximizes their ability
- **High loyalty trait**: Only players with high loyalty are even candidates
  for a meaningful discount. Most players take the best offer.

Even when all conditions are met, the discount is modest — a few percent off
market value, not a dramatic pay cut. Players have short careers and agents
who remind them of that.

### Retention tools

- **Exclusive negotiating window**: You get first crack at your own free
  agents before other teams can talk to them
- **Franchise tag**: Guarantees a one-year deal at the top-5 positional
  salary average. Expensive but retains the player. Can only tag one
  player per year. Players generally dislike being tagged (see morale
  impact above).
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
