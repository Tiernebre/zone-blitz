# Archetypes

Every player, coach, and scout carries an **archetype** — a categorical tag describing *kind*, orthogonal to quality.

## Why archetypes are first-class

1. **Legibility.** An attribute vector is unreadable at a glance. A tag (`Air Raid QB, rhythm passer`) plus a quality tier is comparable across a 300-prospect board.
2. **Fit semantics.** Scheme fit ([`coach-schemes.md`](./coach-schemes.md)) requires a shared vocabulary for what a scheme demands and what a player is.
3. **Generative coherence.** Attributes sampled independently produce incoherent players. Sampling conditioned on archetype (draw archetype, then sample attributes from its joint distribution) yields consistent profiles.
4. **Market surfaces.** Markets price archetype × quality × age × position. Trade and FA pricing need the archetype layer.

## Player archetypes

3–6 per position. Illustrative set, to be finalized with attribute sets:

- **QB:** pocket passer, rhythm passer, gunslinger, dual-threat, game manager.
- **RB:** bell-cow power, zone / one-cut, receiving back, change-of-pace, goal-line.
- **WR:** X (boundary possession), Z (movement / vertical), slot, YAC weapon, deep-threat.
- **LT:** pass-set, gap-scheme, zone athlete, swing backup.
- **EDGE:** speed rusher, power converter, hybrid / set-edge, rotational specialist.
- **CB:** press man, zone-off, nickel / slot, ball-hawk, long-speed boundary.

Properties:

- **Orthogonal to quality.** Elite and Replacement can share an archetype.
- **Scouted, not exposed.** Clear-archetype players are easier to peg; tweeners are harder. Scout quality cuts noise.
- **Not permanent.** Development under coaching or a scheme change can shift archetype. Mostly stable by year 3–4.

## Coach archetypes

Two layers:

- **Head coach** — organizational. CEO, offensive-minded, defensive-minded, players' coach, disciplinarian, rebuilder. Shifts staff construction and locker-room development. Largely scheme-independent.
- **Coordinator** — effectively the scheme. Air Raid OC, Wide Zone OC, Shanahan-tree OC, Tampa-2 DC, 3-4 pressure DC, Cover-3-match DC. Changing archetype means changing scheme; rare.
- **Position coach** — narrower, unit-specific. Zone-blocking OL coach, press-technique DB coach, run-game specialist.

Archetype combinations define organizational coherence. A CEO HC + Wide Zone OC + aggressive-pressure DC is a coherent stack; a defensive-minded HC + Wide Zone OC + Cover-3 DC requires cross-side roster alignment.

## Scout archetypes

Describe where a scout's noise floor is low:

- **Positional specialists** — QB whisperer, trenches, secondary, skill-position, special-teams. Low noise on specialty, high noise elsewhere.
- **Regional specialists** — Southeast, Big Ten, West Coast, small-school / FCS, international.
- **Traits vs tape** — combine / measurables scouts, film grinders, character / interview scouts. Catch different failure modes.
- **Generalists** — moderate noise everywhere.

The Director of Scouting assembles a **portfolio**. A department of five QB whisperers with no OL scouts has a positional blind spot regardless of individual scout quality.

## Market pricing

Consensus boards (built from NPC scouting) tag archetypes. FA and draft markets price **archetype × quality × age × position**. Scarce archetypes at premium positions command premium money. Scouting edge comes from assembling the right archetype mix in the department to beat consensus on classification and quality.

## Related

- [`player-attributes.md`](./player-attributes.md)
- [`coach-schemes.md`](./coach-schemes.md)
- [`busts-and-gems.md`](./busts-and-gems.md)
- [`scarcity-economy.md`](./scarcity-economy.md)
