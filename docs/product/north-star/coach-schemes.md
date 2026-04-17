# Coach schemes, tendencies, and fit

Coaches are not a single quality rating. Each carries a scheme, a tendency vector, and developmental attributes. These drive the sim engine's decision layer and constrain what kind of roster works for them.

## Coach composition

Every coach (HC, OC, DC, position coach) has:

1. **Scheme** — categorical.
   - Offense: Air Raid, West Coast, Wide Zone, Gap / Power, Spread-RPO, etc.
   - Defense: 3-4 / 4-3, Cover-3 match, Tampa 2, pressure-heavy, etc.
   - Determines playbook shape and the player archetypes the scheme demands.
2. **Tendencies** — continuous style attributes. Aggressiveness (pass rate in neutral scripts, 4th-down go-rate, 2-pt appetite), tempo, run/pass balance, blitz rate, man/zone split, personnel mix (11 vs 12 vs 21 personnel, nickel vs dime). Shift the baselines in `data/bands/play-call-tendencies.json` and `data/bands/situational.json`.
3. **Developmental attributes** — coaching-up, scheme install, in-game adjustments, locker-room management. Shift the sim's resolution layer for their unit (e.g., strong OL coach reduces sack rate). Capped: no coach turns a 50 OL into a 90.

User sees scouted versions of all three. See [`busts-and-gems.md`](./busts-and-gems.md).

## Scheme fit

Player true attributes are fixed. Player production in a scheme is not — it depends on whether the player's archetype matches the scheme's demands.

Examples:
- A zone-blocking LT and a gap-blocking LT have different attribute profiles. Same LT is a gem under Wide Zone, a bust under Gap/Power.
- An Air Raid OC expects quick processing and rhythm passing. A West Coast OC expects accuracy and timing. Same 78 QB produces different output in each.
- A Tampa-2 DC needs a rangy MLB and two-high safeties. A pressure-heavy DC needs EDGEs and man CBs.

Roster value is coach-conditional. An HC change reshapes the effective value of existing players and forces a scheme-transition cost in roster churn, FA spend, or development patience.

## Sim engine implications

- **Decision layer** is parameterized by scheme + tendencies. Play-call distributions = league baseline conditioned on scheme, shifted by tendency vector.
- **Resolution layer** factors player-scheme fit into the attribute-shift term. A 78 LT in gap scheme resolves closer to a 72 LT's shift; the same 78 LT in zone resolves closer to an 82. True attributes don't change; effective shift does.
- Scheme is **season-stable**. No mid-season scheme flips. A new HC between seasons brings a new scheme.

## GM implications

- Roster board surfaces scheme fit alongside attributes ("74 in general, 68 in current scheme").
- "Change of scenery" FAs are players whose previous scheme flattered or hid their fit. Scouting department can surface these before consensus reprices them.
- Coach search is a scheme-vs-roster optimization, not a ranked list of best HCs.

## Related

- [`archetypes.md`](./archetypes.md)
- [`player-attributes.md`](./player-attributes.md)
- [`busts-and-gems.md`](./busts-and-gems.md)
