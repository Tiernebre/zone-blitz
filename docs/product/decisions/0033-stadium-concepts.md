# 0033 — Stadium concepts: sizing, location, naming, and lifecycle

- **Date:** 2026-04-16
- **Status:** Proposed
- **Area:** [Teams & Branding](../north-star/teams-and-branding.md),
  [Game Simulation](../north-star/game-simulation.md)

## Context

The teams-and-branding north-star currently treats stadiums as purely cosmetic —
a name and a short flavor description with no mechanical impact. But stadiums
are one of the most tangible expressions of a franchise's identity and
investment. Real NFL stadiums affect revenue (capacity determines gate
receipts), home-field advantage (crowd noise, weather exposure), franchise
prestige (a state-of-the-art venue attracts free agents; a crumbling one repels
them), and long-term financial planning (construction costs, naming-rights
deals, renovation cycles).

Leaving stadiums as decoration wastes a natural source of owner-level decisions.
The fused owner/GM role in Zone Blitz means the player is responsible for both
football operations _and_ franchise infrastructure — stadium investment should
be part of that responsibility.

## Decision

Stadiums become mechanical entities with properties that affect revenue,
home-field advantage, free-agent appeal, and long-term franchise planning.

### Stadium properties

Every stadium has the following attributes:

- **Name.** The stadium's public-facing name. May change over time through
  sponsorship deals or owner choice (see Naming below).
- **Surface type.** Grass or artificial turf. Affects injury risk (turf
  increases soft-tissue injury rates slightly, per NFL injury data) and rushing
  performance (power backs prefer grass; speed backs are less affected by
  surface).
- **Roof type.** Open-air, retractable roof, or domed. Determines weather
  exposure:
  - _Open-air_ — fully exposed to weather. Rain, snow, wind, and extreme
    temperatures affect gameplay. Home teams that practice in the same climate
    gain a familiarity edge.
  - _Retractable roof_ — owner chooses whether to open or close on game day.
    Open behaves like open-air; closed behaves like domed.
  - _Domed_ — weather-neutral. No precipitation or wind effects. Temperature is
    controlled. Dome teams lose the weather-edge when hosting cold-weather
    opponents but gain consistency.
- **Capacity.** Seat count, ranging from ~50,000 (small-market minimum) to
  ~82,000 (large-market flagship). Determines maximum gate revenue per game.
- **Quality rating (1–100).** Represents the overall condition and modernity of
  the facility — amenities, sight lines, luxury suites, training facilities, and
  fan experience. Starts at a value determined by the initial construction tier
  and degrades over time unless maintained.
- **Age.** Years since construction or last major renovation. Drives the natural
  degradation rate of quality.
- **Location climate.** Derived from the franchise's city/region. Determines
  which weather events are possible for open-air and retractable-roof stadiums
  (a dome in a cold city still has a cold-weather _city_, which matters for
  outdoor practice facilities and free-agent appeal). Climate categories: warm,
  temperate, cold, dome-irrelevant (indoor practice facilities mitigate this for
  domed stadiums).

### Capacity and revenue

Stadium capacity sets the ceiling for per-game gate revenue:

- **Gate revenue = capacity x attendance rate x average ticket price.** Ticket
  price is influenced by market size and team competitiveness. Attendance rate
  is driven by team performance, market size, stadium quality, and ticket
  pricing.
- **Luxury suites and premium seating** scale with quality rating, not raw
  capacity. A 60,000-seat stadium with a quality rating of 95 can generate more
  premium revenue than an 80,000-seat stadium with a quality rating of 40.
- **Revenue sharing** — a portion of gate revenue is shared league-wide (like
  the NFL's visitor revenue share), so capacity differences create advantages
  but not insurmountable ones.
- Capacity is fixed at construction. Expansion requires a major renovation (see
  Upgrades below).

### Home-field advantage

Stadiums contribute to home-field advantage through three channels:

1. **Crowd noise.** A function of attendance (capacity x fill rate) and stadium
   acoustics (domed stadiums are louder per fan than open-air). High crowd noise
   increases false-start penalty probability for the visiting offense and can
   degrade visiting QB communication attributes (audible success, pre-snap read
   accuracy).
2. **Weather familiarity.** Open-air stadiums in extreme climates (cold, hot,
   high altitude) penalize visiting teams that normally play in different
   conditions. Home teams practiced in those conditions all season. The modifier
   is small but cumulative — a dome team visiting a cold open-air stadium in
   December faces a real disadvantage.
3. **Surface familiarity.** Minor modifier — players who practice on the same
   surface type have slightly lower injury risk and slightly better footing.

These modifiers are intentionally small. Home-field advantage in the real NFL is
roughly 57% win rate; the sim should land in the 55–60% band for home teams
league-wide, with stadium properties explaining _variance_ in home-field
advantage between teams (a loud dome in a cold city has more home-field edge
than a quiet open-air stadium in a temperate climate).

### Stadium naming

- **Initial name.** Generated at franchise creation. Can be a geographic
  landmark name (e.g., "Cascade Stadium"), a generic venue name (e.g., "Metro
  Field"), or the franchise name itself (e.g., "Riverhawks Stadium").
- **Naming-rights deals.** Franchises can sell stadium naming rights to a
  corporate sponsor for a multi-year contract that provides annual revenue.
  Naming-rights revenue scales with market size and team competitiveness. The
  stadium name changes to reflect the sponsor (e.g., "TechCorp Field at Cascade
  Stadium" or simply "TechCorp Arena"). When the deal expires, the franchise can
  negotiate a new deal or revert to the original name.
- **Owner-initiated rename.** The owner/GM can rename the stadium at any time
  (e.g., after a renovation or relocation). Renaming is cosmetic but appears in
  media coverage and franchise history.
- **Relocation resets the stadium.** When a franchise relocates, it gets a new
  stadium in the destination city. The old stadium name is retired and recorded
  in franchise history. The new stadium's properties (capacity, roof type,
  surface, quality) are determined by the relocation package.

### Stadium lifecycle: upgrades and deterioration

Stadiums are long-lived assets that degrade over time and require investment to
maintain or improve.

- **Natural deterioration.** Quality rating decreases by a small amount each
  season (roughly 1–3 points per year, accelerating as the stadium ages past ~20
  years). An unmaintained stadium eventually becomes a liability — lower
  attendance, reduced free-agent appeal, media narratives about "the worst
  stadium in the league."
- **Annual maintenance.** The owner/GM allocates a maintenance budget each
  offseason. Sufficient maintenance slows or halts quality degradation.
  Under-investing accelerates decline. Over-investing (beyond maintenance) does
  not improve quality — that requires upgrades.
- **Renovations.** A mid-lifecycle investment that restores quality and can add
  capacity or change surface type. Renovations are expensive, take one offseason
  to complete, and reset the stadium's effective age for deterioration purposes.
  A franchise can renovate multiple times over a stadium's life.
- **New stadium construction.** The most expensive option — building a brand-new
  stadium. Takes multiple seasons of planning and construction (the franchise
  plays in the old stadium during construction). A new stadium starts at high
  quality, resets age to zero, and allows the owner to choose all properties
  (capacity, roof type, surface). New construction is rare — once every 25–40
  years for most franchises.
- **Stadium quality thresholds.** At certain quality levels, effects trigger:
  - _80+:_ "State-of-the-art" — premium revenue bonus, free-agent appeal boost,
    positive media coverage.
  - _50–79:_ "Adequate" — no bonuses or penalties. The default band for most
    stadiums in their middle years.
  - _30–49:_ "Aging" — attendance penalty, reduced naming-rights revenue, media
    narratives about needing a new stadium.
  - _Below 30:_ "Decrepit" — significant attendance and revenue penalties,
    free-agent appeal penalty, fan anger, and NPC owners begin considering
    relocation.

### Interaction with weather

Weather is determined by the combination of the franchise's location climate and
the stadium's roof type:

- **Open-air + cold climate in December** = possible snow, wind, freezing
  temperatures. Affects passing accuracy, fumble rate, kicking accuracy.
- **Open-air + warm climate** = heat effects in early-season games (fatigue
  accumulates faster).
- **Domed or closed retractable** = climate-controlled. No weather effects
  regardless of location.
- **Retractable roof, owner's choice** = a game-day decision. Opening the roof
  in bad weather to gain home-field advantage against a dome team is a valid
  strategic choice.

Weather effects on simulation are documented in the game-simulation north-star's
player performance model. Stadium properties determine _which_ weather
conditions apply; the sim engine determines _how_ those conditions modify play
outcomes.

### Interaction with attendance

Attendance is not a fixed percentage — it fluctuates based on:

- **Team performance.** Winning teams draw larger crowds. A team on a long
  losing streak sees attendance drop.
- **Stadium quality.** Higher-quality stadiums attract more fans per game,
  independent of team performance.
- **Market size.** Large markets have deeper fan bases and higher baseline
  attendance. Small markets have more passionate but smaller fan bases —
  attendance swings are less dramatic.
- **Ticket pricing.** Higher prices can reduce attendance but increase
  per-ticket revenue. The owner/GM sets pricing strategy (premium, moderate,
  accessible) as a seasonal decision.
- **Weather and opponent.** Divisional rivalry games and playoff-race games draw
  better. Cold, rainy games in an open-air stadium suppress casual attendance.
- **Playoff drought.** Extended losing erodes the fan base over multiple
  seasons. A franchise that hasn't made the playoffs in a decade has
  structurally lower attendance even when having a good year.

### Interaction with team performance

Stadium properties feed into simulation through the home-field advantage
modifiers described above. Additionally:

- **Training facilities** (implied by quality rating) affect player development
  rates. A high-quality stadium implies better training infrastructure, giving a
  small bonus to offseason player development. This is intentionally minor —
  coaching and player attributes dominate development.
- **Injury risk** varies slightly by surface type. Artificial turf correlates
  with higher non-contact soft-tissue injury rates in real NFL data. The sim
  applies this as a small modifier to per-play injury probability for games
  played on turf.

### Genesis and Year 1

At league creation, each franchise's stadium is generated alongside its brand
package:

- **Capacity** correlates with market size (large markets get larger stadiums)
  with some randomness.
- **Quality** starts in the 60–85 range for all franchises — new league, new
  stadiums, but not all are flagships.
- **Roof type and surface** are generated based on location climate and random
  variation. Cold-weather cities are more likely to have domes; warm-weather
  cities lean open-air.
- **Age** starts at 0–15 years (stadiums are assumed to have been built in
  anticipation of or recently before the league's founding).
- **Stadium name** is generated as part of the brand package, consistent with
  the existing team generation system.

## Alternatives considered

- **Keep stadiums purely cosmetic (status quo).** Simplest implementation, but
  wastes a natural source of owner-level decisions and franchise
  differentiation. The fused owner/GM role benefits from having infrastructure
  decisions alongside football decisions. Rejected because it leaves the owner
  half of the role with too little to do.

- **Detailed architectural simulation (sections, concourses, parking).** Too
  granular for a football management sim. Players don't want to manage parking
  lot layouts. Rejected in favor of abstract quality and capacity ratings that
  capture the meaningful effects without micromanagement.

- **Player-controlled stadium construction from scratch (pick location, design
  layout, choose amenities).** Interesting but scope-heavy and tangential to the
  core football management loop. A future expansion could add a stadium builder
  mode, but the v1 system uses abstract ratings and predefined options (roof
  type, surface, capacity tier). Rejected for v1 to keep scope manageable.

- **No deterioration (stadiums stay static).** Removes the long-term investment
  decision entirely. Real stadiums age and require upkeep — this is a natural
  part of franchise management over decades. Rejected because the multi-decade
  franchise arc is richer when infrastructure decisions compound over time.

## Consequences

- **The teams-and-branding north-star must be updated.** Stadium name and
  description currently live under "Identity fields" with an explicit note that
  stadiums have no mechanical stats. This ADR elevates stadiums to mechanical
  entities. The north-star should be updated to reflect the new stadium
  properties and reference this ADR.

- **Revenue modeling gains a new input.** Gate revenue, naming-rights income,
  and premium seating revenue are all new revenue streams that feed into the
  franchise's financial model. This interacts with salary cap and non-cap
  spending budgets.

- **Home-field advantage becomes heterogeneous.** Instead of a flat home-field
  modifier, each stadium produces a different home-field edge based on its
  properties. This creates meaningful variation in how valuable home games are
  across the league.

- **Stadium investment becomes an owner-level decision loop.** Maintenance
  budgets, renovation timing, and new construction planning join the set of
  decisions the owner/GM makes each offseason. This enriches the "owner" half of
  the fused role.

- **Weather integration requires stadium data.** The simulation engine must
  query the home team's stadium properties (roof type, surface, location
  climate) when determining weather conditions for each game. This is a new
  input to the player performance model.

- **League genesis must generate stadium properties.** The franchise generation
  pipeline adds capacity, quality, roof type, surface, age, and climate to the
  existing brand package generation.

- **Follow-up work:**
  - Update the teams-and-branding north-star to reflect mechanical stadium
    properties and reference this ADR.
  - Define the stadium database schema (capacity, quality, roof type, surface,
    age, climate).
  - Implement stadium deterioration and maintenance in the offseason phase.
  - Add stadium properties to the franchise generation pipeline.
  - Integrate stadium-derived home-field advantage modifiers into the simulation
    engine.
  - Design the stadium management UI (maintenance budget, renovation options,
    naming-rights deals).
  - Add attendance modeling as a function of team performance, stadium quality,
    market size, and pricing.

## Related decisions

- [0017 — League genesis default creation flow](./0017-league-genesis-default-creation-flow.md)
- [0015 — Simulation resolution model](./0015-simulation-resolution-model.md)
