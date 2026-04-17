# The scarcity economy

How `data/bands/` drives the player market. The market's scarcity comes directly from real-NFL distributions; the sim does not add difficulty on top.

## Data atlas

- **Population size.** [`data/docs/position-market-sizing.md`](../../../data/docs/position-market-sizing.md): ~96 unique QBs touch the field league-wide in a real NFL season across 32 teams. In an 8-team league, that scales to ~16–24 QBs total. With the QB bimodal shape (5–8% Elite), 1–2 Elite QBs exist league-wide in a typical season.
- **Bimodality at premium positions.** QB has a thin Average tier (~25–30%) with mass piled into Weak/Replacement (~50–60%) and a thin Strong/Elite tier (~23%). See [`player-attributes.md`](./player-attributes.md).
- **Draft hit rates.** [`data/bands/draft-hit-rates.json`](../../../data/bands/draft-hit-rates.json): per-round × position hit rates over ~2,000 real picks. Day-3 QBs rarely become starters.
- **Usage concentration.** [`data/bands/position-concentration.json`](../../../data/bands/position-concentration.json): QB1 ~81% of pass attempts, RB1 ~57% of carries, WR1 ~38% of WR targets. Backups behind stars accumulate a fraction of counting stats.
- **Pay scales with scarcity.** [`data/bands/free-agent-market.json`](../../../data/bands/free-agent-market.json) + [`data/bands/contract-structure.json`](../../../data/bands/contract-structure.json): top-10 AAV at premium positions (QB, EDGE, LT, WR) dominates. Guarantees, signing-bonus proration, and back-loaded cap-hit shapes mean contracts persist on the books.
- **Aging.** [`data/bands/career-length.json`](../../../data/bands/career-length.json): P(active | age) and position-specific curves. RBs decline fastest; OL and QB have longer runways.
- **Injuries.** [`data/bands/injuries.json`](../../../data/bands/injuries.json): rates by position, severity, category. Can permanently reduce ratings.
- **Market mechanisms.** Comp picks, franchise / transition tags (`tag-usage.json`), UDFA (`udfa-market.json`), UFA pool (`ufa-pool-composition.json`), pick trade value (`draft-pick-value.json`).

## Consequences

1. **Offseason tradeoffs are forced.** Tag-and-lose-flexibility, walk-and-take-comp, reach-for-position-of-need, eat-dead-cap. All emerge from the data, not from a difficulty setting.
2. **Contracts persist.** Because cap structure is NFL-real, a three-year contract constrains three years of decisions.
3. **Scouting and scarcity are coupled.** Better scouts produce fewer wasted picks. Scouting is the mechanism by which a franchise beats scarcity. See [`busts-and-gems.md`](./busts-and-gems.md).
4. **NPC GMs operate under identical constraints.** They miss picks, overpay, and tag. The market moves because every franchise competes for the same pool.
5. **8 teams tightens absolute numbers.** One Elite QB league-wide is the median outcome, not the tail case.

## Related

- [`player-attributes.md`](./player-attributes.md)
- [`busts-and-gems.md`](./busts-and-gems.md)
- [`archetypes.md`](./archetypes.md)
- [`coach-schemes.md`](./coach-schemes.md)
