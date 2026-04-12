# Trading

Trading is where the social and strategic dimensions of the game collide. A
great trade system makes you feel like a deal-maker — reading the market,
identifying leverage, and negotiating to build your team the way you envision
it.

## Design Philosophy

Trades should feel like **negotiations, not transactions**. The goal isn't to
fill out a form and click "propose." It's the back-and-forth: "I'll give you my
2nd for your corner." "Make it a 1st." "What if I throw in my backup DE?"
"Deal."

### No visible trade values

Human players never see a trade value number attached to a player or pick. Real
GMs don't have a number hovering over a player that says "trade value: 73."
They use judgment, context, scouting, and negotiation.

If we show trade values, trades become math — "my 75 for your 73 plus a pick."
If we hide them, trades become *arguments*, which is way more fun. You learn
what the market values by making offers and seeing reactions.

The NPC AI uses an internal value model, but it's opaque to the player.

## Trade Assets

### Players

Players come with their contracts. A great player on a massive deal has
different trade value than the same player on a rookie contract. Cap
implications are part of every trade:

- Acquiring team must have cap space to absorb the contract (or make room)
- Dead cap hits from traded players affect the sending team
- Contract structure (guaranteed vs. non-guaranteed) matters for both sides

### Draft Picks

- Current year picks and future picks (up to ~3 years out)
- Value follows a curve — first-round picks are worth dramatically more than
  later rounds, and current picks are worth more than future picks (uncertainty
  discount)
- Scarcity matters: a team that has already traded away future firsts has less
  trade capital

### Conditional Picks

Picks with conditions that resolve based on future performance:

- "2028 2nd round pick, becomes a 1st if [traded player] makes the Pro Bowl"
- "2029 3rd, becomes a 2nd if [acquiring team] makes the playoffs"
- Conditions can be based on: player stats, team record, individual awards,
  games played

Conditional picks create drama that plays out over multiple seasons. You make a
trade in year 1 and sweat the conditions in year 3.

### Pick Swap Rights

The right to swap picks in a specific round of a future draft. You get the
better of the two picks. A subtle but powerful asset in real-world NFL trades
(the Herschel Walker trade, various NBA deals).

## Multiplayer Trading

### The Negotiation Table

The core multiplayer trade UI should feel like sitting across from another GM:

- Both parties see the assets currently on the table
- Either side can add or remove assets in real time
- A chat channel runs alongside the negotiation
- Either party can "propose" (lock in the current deal for the other to accept
  or continue negotiating)
- Counter-offers are natural — just modify the assets and re-propose

### Trade Chat

Communication is half the game. When you're trading with a human:

- Sell your side: "This guy led the league in pressures last year"
- Bluff: "I've got another offer on the table, but I'd rather deal with you"
- Gather intelligence: "What positions are you looking to add?"
- Build relationships: a GM who's been fair with you in the past earns trust

### Multi-Team Trades

Three-way (or more) trades for complex roster construction:

- Team A sends a player to Team B
- Team B sends a pick to Team C
- Team C sends a player to Team A

These are rare but spectacular when they happen. The UI needs to support them
cleanly.

### Trade Deadline

The trade deadline should create urgency and drama:

- A fixed point in the season calendar after which no trades can occur
- Contenders become aggressive buyers in the final hours
- Struggling teams become sellers, looking to recoup future assets
- The pressure of a ticking clock changes how aggressively you deal
- "Deadline day" should feel like an event — flurry of activity, breaking news,
  last-minute deals

## NPC Trading

### Proactive NPC behavior

NPC teams don't just wait for you to call. They:

- **Initiate trade offers to you** — "The Packers are interested in your
  veteran DE and are offering a 3rd round pick"
- **Trade with each other** — you check the news feed and see deals you had
  nothing to do with. The league is alive.
- **Shop players** — an NPC in rebuild mode might let it be known that their
  star WR is available, creating a bidding dynamic
- **Call at the deadline** — if you're a contender, NPC sellers will reach out
  with offers for rental players

### NPC personality drives trade behavior

Different AI archetypes approach trades differently:

- **"Win Now" GMs** initiate trades for veterans, willing to overpay slightly
  for proven talent, trade future picks aggressively
- **"Developer" GMs** hoard picks, actively shop aging veterans before they
  decline, rarely initiate trades for established players
- **"Moneyball" GMs** look for undervalued assets, target players on bad
  contracts that other teams want to dump, exploit desperation
- **"Old School" GMs** prefer to build through the draft, skeptical of
  blockbuster trades, value "their guys"
- **"Gambler" GMs** *(rare)* the most active traders in the league; initiate
  blockbuster offers constantly, trade up aggressively in the draft, always
  willing to mortgage future picks for the player they're convinced about;
  they warp the trade market when they're in your league — other GMs can
  exploit their impulsiveness or get outbid when they drive up the price

### NPC trade evaluation

The AI should feel like a tough but fair negotiator:

- **No fleecing**: The AI won't accept wildly lopsided trades. You should be
  able to "win" a trade, but not rob a team blind.
- **Context-aware**: An NPC in rebuild mode values future picks more. An NPC
  contender values win-now players more. The same player has different value
  to different teams.
- **Scheme-aware**: An NPC running a 3-4 values 3-4 players more. They might
  sell a player who doesn't fit their scheme at a discount.
- **Not a brick wall**: If you're offering fair value, the AI should engage.
  There's nothing more frustrating than an AI that rejects every trade proposal
  regardless of quality.
- **Personality-biased**: A "Win Now" GM might accept a slightly unfavorable
  deal if it gets them a player who helps them compete this year.

## Trade Review and Fairness

### Commissioner tools (multiplayer)

- Commissioner veto power for trades
- Optional league-wide vote system for trade approval
- Configurable trade review period before trades process

### Trade history

All completed trades are public record:

- Full trade details visible to the entire league
- Historical outcomes: track how traded players and picks performed
- Reputation system: over multiple seasons, GMs build a track record that
  informs how others negotiate with them

### Collusion prevention

In multiplayer, the system should discourage but not over-police:

- Extreme outlier trades get flagged for commissioner review
- Transparent trade history lets the league self-police
- NPC teams never make lopsided trades, so the AI sets a baseline for
  "reasonable"
