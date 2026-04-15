# Teams & Branding

A franchise sim without team identity is a spreadsheet. The teams need to feel
real — distinct cities, names, colors, stadiums, and histories that make you
care about your franchise and hate your rivals. Team branding is the connective
tissue between the mechanical systems and the emotional experience of running a
franchise for twenty seasons.

## Design Philosophy

### Teams are fictional and open-source

This is not an NFL-licensed game. Every team is fictional — invented cities (or
real cities with invented teams), invented names, invented histories. This is a
feature, not a limitation. Fictional teams mean:

- No licensing constraints on what we can ship or how the community can
  contribute
- Players form attachments to _their_ franchise, not to a pre-existing brand
  they already have opinions about
- The community can create and share custom team packs — real NFL rosters,
  college teams, international leagues, entirely fictional worlds

### Branding is identity, not decoration

A team's brand isn't a skin layered on top of the game. It's woven into the
experience. Your team's colors theme your dashboard. Your rival's colors show up
on scouting reports and matchup screens. The city you're in determines your
market size, which determines media pressure, free agent appeal, and owner
expectations. Branding creates the _feeling_ of being the GM of the Portland
Riverhawks, not just "Team 14."

### Customization is a first-class feature

Some players want to jump in and start drafting immediately. Others want to
hand-pick their 32 teams, design custom franchises, or import a community team
pack. Both are valid. The system ships with a complete set of ready-to- play
teams and supports full customization for those who want it.

---

## Team Brand Package

Every team in the league has a complete brand package. These fields define the
team's identity across the entire game:

### Required fields

- **City / market name**: The city or region the team represents (e.g.
  "Portland," "San Antonio," "Great Lakes"). Determines the team's market tier
  and geographic identity.
- **Team name**: The franchise name (e.g. "Riverhawks," "Stampede,"
  "Ironworks"). Combined with the city, this forms the full team name shown
  everywhere in the game.
- **Abbreviation**: A 2-3 letter code used in standings, box scores, and compact
  UI elements (e.g. "POR," "SAT," "GLK").
- **Primary color**: The dominant brand color. Used for dashboard theming,
  jersey representation, and UI accents throughout the game.
- **Secondary color**: The supporting brand color. Used for contrast elements,
  trim, and secondary UI accents.
- **Accent color**: A tertiary color for highlights, emphasis states, and detail
  work.

### Identity fields

- **Mascot**: The team's mascot identity (e.g. "Talon the Riverhawk"). Flavor
  that appears in media coverage and franchise lore.
- **Stadium name**: The name of the team's home venue (e.g. "Cascade Stadium,"
  "Ironworks Field"). Purely identity — stadiums do not have mechanical stats
  like capacity or age.
- **Stadium description**: A short flavor description of the venue — open-air or
  domed, grass or turf, notable features. Adds atmosphere to game-day
  presentation without mechanical impact.
- **Logo description**: A text description of the team's visual identity. This
  supports future visual rendering and helps players identify the brand's
  aesthetic even before logo assets exist.

### League structure fields

- **Conference**: Which conference the team belongs to.
- **Division**: Which division within the conference.

---

## Default Team Pool

The game ships with **50 pre-built fictional teams**, each with a complete brand
package. These teams are open-source and maintained as part of the project.

### Standard teams (32)

The 32 standard teams form the default league. When a player creates a new
league without customizing the team list, these are the teams they get. They are
designed to:

- Cover a variety of real-world American cities and regions, giving geographic
  diversity
- Span the full range of market tiers — large markets, mid-markets, and small
  markets
- Have distinct, memorable names and color schemes that don't overlap
- Feel like they could be real franchises with real histories

### Expansion teams (18)

The 18 expansion teams are available for leagues that want more than 32 teams or
want to swap out standard teams for alternatives. They exist so that:

- Leagues with 36, 40, or even 50 teams have enough pre-built options
- Players who don't like a particular standard team can swap it out without
  creating a custom team from scratch
- The league creation experience offers meaningful choice even for players who
  don't want to build teams from scratch

### Team selection at league creation

When creating a league, the commissioner selects which teams to include:

- **Quick start**: Use the 32 standard teams as-is. No decisions required.
- **Pick and choose**: Browse all 50 teams and select which ones to include.
  Want to drop the Great Lakes Ironworks and replace them with the Memphis
  Pharaohs from the expansion pool? Done.
- **Custom mix**: Combine default teams, expansion teams, and custom-uploaded
  teams in any combination.
- **Fully custom**: Upload an entirely custom set of teams for a unique league
  experience.

The league size is flexible — 24, 28, 32, 36, or any number the commissioner
chooses. Division and conference structure adjusts accordingly (see
[League Management](./league-management.md)).

---

## Market Size

The city a team calls home isn't just a name on the jersey. Market size creates
structural asymmetries between franchises that shape the GM experience in
meaningful ways.

### Market tiers

Each city/market falls into a tier:

- **Large market**: Major metropolitan areas. High media scrutiny, strong free
  agent appeal, demanding fan bases, and owners who expect to compete. The GM of
  a large-market team operates under a spotlight — every move is analyzed, every
  loss is a crisis, and patience is harder to come by. But the advantages are
  real: top free agents _want_ to play here, national media covers your games,
  and a winning team in a big market becomes a cultural force.
- **Mid market**: Solid regional cities. Moderate media attention, reasonable
  free agent appeal, and fan bases that are passionate but not overwhelming. The
  sweet spot for many GMs — enough resources and appeal to compete, without the
  pressure cooker of a major market. Mid-market teams have to work harder to
  attract marquee free agents but aren't at a structural disadvantage in the
  draft or through the cap.
- **Small market**: Smaller cities and regions. Lower media scrutiny, weaker
  free agent appeal, but often the most loyal and passionate fan bases. The GM
  of a small-market team has more patience from the owner and media, but fewer
  structural advantages. Top free agents rarely choose small markets without
  overpaying. Building through the draft isn't just a strategy here — it's a
  necessity.

### What market size affects

- **Free agent appeal**: Large markets attract free agents more easily.
  Small-market teams may need to overpay to land the same player. See
  [Free Agency & Contracts](./free-agency-and-contracts.md).
- **Media pressure**: Large-market GMs face more intense coverage and faster
  narrative cycles. A two-game losing streak in a large market is a "crisis." In
  a small market, it's a "rough stretch." See [Media](./media.md).
- **Peer and fan pressure**: Because Zone Blitz franchises are run by a fused
  owner/GM (see [League Genesis](./league-genesis.md)), there is no separate
  owner pressuring you from above. Market size instead shapes how loudly fans
  and media react: a large-market franchise operates under constant scrutiny,
  while a small-market franchise has more runway before league peers and the fan
  base begin applying pressure.
- **Fan expectations**: Large-market fans expect contention. Small-market fans
  are more tolerant of rebuilds but more devastated by relocation rumors.
- **Revenue and non-cap spending**: While the salary cap is the same for
  everyone, market size influences non-cap spending. Bigger markets tend to
  generate more revenue, which translates to better facilities, larger scouting
  departments, and more organizational support — all of which you, as the
  owner/GM, choose how to allocate.

### Market size is not destiny

A small-market franchise with sharp decisions, smart hiring, and a great
scouting operation can build a dynasty. A large-market franchise that mismanages
its talent and hires the wrong staff can be a dumpster fire for a decade. Market
size creates advantages and disadvantages, but it doesn't determine outcomes.
The best owner/GMs figure out how to leverage their market's strengths and
mitigate its weaknesses.

---

## Relocation

Relocation is the most dramatic event in a franchise's history. A team leaving
its city is a betrayal to its fans and a fresh start in a new market. It's rare,
painful, and permanent.

### Who decides

**You do — because you're the owner.** In Zone Blitz, every franchise is run by
a fused owner/GM (see [League Genesis](./league-genesis.md)), so relocation is
an owner-level call the franchise's operator makes for themselves. For human-run
franchises, that's you. For NPC franchises, the franchise's AI persona makes the
call based on its market, finances, and personality.

For your own franchise, relocating is a heavy choice with real fallout:

- Stadium situation, market economics, fan backlash, and league realignment all
  weigh in
- You deal with the consequences — roster disruption, coaching turnover, fan
  anger in the old city, and the challenge of rebuilding brand equity in the new
  one
- The football doesn't stop. You still have a roster to manage, a draft to
  prepare for, and games to win — just in a different city

### What changes

Relocation can range from a partial rebrand to a complete identity reset:

**Partial rebrand** (keep the identity, change the city):

- New city / market name
- New market tier (a team moving from a small market to a large market gains the
  structural advantages — and pressures — of the new market)
- New stadium name and description
- Team name, colors, mascot, and abbreviation stay the same
- Think: a team keeping its name and identity but playing in a new city. The
  history travels with the franchise.

**Full rebrand** (new city, new identity):

- New city / market name and market tier
- New team name, colors, mascot, abbreviation
- New stadium name and description
- New conference/division assignment (if the move creates geographic
  misalignment, the league may realign)
- The old identity is retired. The franchise history is preserved (records,
  stats, draft history) but the brand is new. It's a clean break.

### Relocation is rare

Relocation should happen infrequently — once every several decades of league
history at most. It's a significant event that the media covers heavily, that
affects league structure, and that players across the league notice. When a
relocation happens, it should feel like a moment in league history, not a
routine occurrence.

Factors that make relocation more likely for NPC franchises:

- Sustained losing combined with low fan engagement
- A franchise that has publicly clashed with its city over stadium funding
- A small-market franchise with an ambitious operator who wants a larger stage
- Expansion-era franchises that never established deep roots

### Impact on the franchise

When you relocate:

- Your roster, coaching staff, cap situation, and draft picks come with you
- Fan and media sentiment reset — the new city's press corps evaluates the
  franchise fresh, and the old city's fans become a lingering narrative
- Free agent appeal changes based on the new market tier
- Division rivals may change if the league realigns
- It's an opportunity and a disruption. Some GMs thrive in the chaos of a fresh
  start. Others never recover from the instability.

---

## Divisions and Rivalries

### Conference and division structure

The default 32-team league is organized into:

- **2 conferences**, each containing divisions
- **Divisions of 4 teams** each (8 divisions total in a 32-team league)

Division structure determines scheduling — you play your division rivals more
frequently, which creates familiarity, stakes, and rivalry. See
[League Management](./league-management.md) for scheduling details.

For non-standard league sizes, the division and conference structure adjusts.
The commissioner can also manually configure conference and division assignments
during league creation.

### Rivalries

Rivalries emerge organically from division play. You play your three division
opponents multiple times per season, every season. Over years and decades, these
repeated matchups create natural rivalries:

- The team that always seems to draft the player you wanted
- The division rival whose GM keeps outbidding you in free agency
- The franchise that knocked you out of the playoffs three years running
- The bottom-feeder you've beaten 12 straight times who suddenly has a loaded
  roster and is coming for you

The game doesn't need to manufacture rivalries with an explicit "rivalry
system." Division structure, repeated matchups, and the natural consequences of
competition create them. What the game _does_ need is to **surface** these
rivalries — through media coverage, head-to-head records, historical context in
matchup presentations, and the emotional weight of divisional games mattering
more for playoff positioning.

### Division identity

Over time, divisions develop reputations:

- A division where three teams are perennial contenders is "the toughest
  division in football" — and the media says so
- A division with one dominant team and three rebuilders is "a one-team
  division" — and the dominant team's playoff seed may not reflect how good they
  actually are
- A division where every team is bad is "the comedy division" — and someone
  still wins it and makes the playoffs at 7-10

These emergent narratives come from the league playing out over time, not from
predefined storylines.

---

## Visual Branding in the UI

Team branding isn't just data — it's visible throughout the game interface.

### Your team's dashboard

Your team's primary, secondary, and accent colors theme your entire management
dashboard. Headers, buttons, accent borders, stat highlights — the interface
_feels_ like your franchise. A team with deep navy and gold has a different
visual atmosphere than a team with bright red and silver.

This theming is cosmetic but matters for the emotional connection to your
franchise. After twenty seasons, your dashboard's color scheme is as familiar as
your team's name.

### Opponent branding

Opponent team colors appear in contexts where you're looking _at_ another team:

- **Scouting reports**: Reports on opposing players carry the opposing team's
  color accents
- **Matchup screens**: Head-to-head game previews show both teams' brands side
  by side
- **Trade negotiations**: When negotiating with another team, their branding is
  present in the trade interface
- **League standings and scores**: Team colors appear as accent indicators
  throughout league-wide views
- **Draft board**: Picks made by other teams show their brand colors

Opponent branding does **not** affect your main dashboard. Your dashboard is
always your team's colors — it's your office, your war room. Other teams' brands
show up when you're looking outward, not when you're managing inward.

---

## Custom Team Uploads

For players and communities who want to go beyond the default 50 teams, the game
supports custom team definitions via JSON.

### How it works

A custom team file defines one or more teams using the same brand package
structure as the default teams. The commissioner uploads this file during league
creation, and the custom teams become available alongside (or instead of) the
defaults.

### What you can customize

Everything in the brand package:

- City, team name, abbreviation
- Full color scheme (primary, secondary, accent)
- Mascot, stadium name, stadium description, logo description
- Conference and division assignment

### What you cannot customize

Custom uploads define branding — they don't modify game mechanics. You can't use
a custom team file to give a team a larger salary cap, better scouting, or extra
draft picks. The mechanical playing field is always level.

### Community team packs

Because the game is open-source, the community can create and share team packs:

- Historical league packs (fictional teams inspired by different eras)
- Regional packs (all teams from one state or country)
- Themed packs (all animal teams, all mythology teams, all space teams)
- Full replacement packs that reimagine the entire league

The default 50 teams are themselves defined in the same format that custom
uploads use — they're just the ones that ship with the game.

---

## Interaction with Other Systems

### League Genesis

Every franchise is run by a fused owner/GM — a founding operator who makes both
ownership-level calls (identity, relocation, expansion votes) and
football-operations calls. Market size, brand, and relocation dynamics
documented here all apply to that single role, not to a separate owner-above-GM
layer. See [League Genesis](./league-genesis.md).

### Free Agency

Market size and team brand reputation affect free agent decisions. A winning
franchise in a large market is the most attractive destination. A dysfunctional
franchise in a small market is the least. Players weigh these factors alongside
money. See [Free Agency & Contracts](./free-agency-and-contracts.md).

### Media

Market size determines media intensity. Large-market teams get more coverage,
more scrutiny, and faster narrative cycles. A team's brand recognition — built
through sustained winning, memorable draft picks, and franchise moments —
affects how much national media attention they receive regardless of market
size. See [Media](./media.md).

### Scouting and Drafting

Team branding has no mechanical impact on scouting or drafting. The draft
doesn't care what colors your team wears. But the _perception_ of your franchise
— shaped by branding, market, and reputation — affects which free agents and
coaches want to join you, which indirectly shapes how you approach the draft.

### League Management

Division and conference assignments are part of the brand package and determine
scheduling. Relocation may trigger league realignment. Custom league creation
uses the team pool system to assemble the league roster. See
[League Management](./league-management.md).

---

## What Makes Team Branding Fun

Team branding is fun because it transforms abstract management decisions into an
experience with emotional stakes:

- "I've run the Portland Riverhawks for fifteen seasons. I founded the
  franchise, I picked these colors, I hired three coaching staffs, I lived
  through two complete roster overhauls and one championship. This dashboard —
  these colors — they're _mine_."
- "Every year, twice a year, I play the division rival who took the quarterback
  I wanted in the draft six years ago. He's a Hall of Famer now. My guy busted.
  I hate that team. I will always hate that team."
- "After fifteen seasons in this city, I made the call to relocate. New city,
  new name, new colors. Half my fans will never forgive me. But the roster is
  still mine, and I'm going to win a championship in the new stadium just to
  prove it was the right call."
- "My friend uploaded a custom team pack based on European cities. Now I'm
  running the London Monarchs in a league with the Paris Sentinels and the
  Berlin Bears. Same game, completely different flavor."
- "I run a small-market franchise. Free agents don't want to come here. The
  media ignores us. But my scouts are elite and my last three draft classes have
  been the best in the league. Nobody's paying attention yet. They will."
