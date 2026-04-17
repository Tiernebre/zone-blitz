# Busts and gems

The gap between a player/coach/scout's **true** attributes and their **publicly scouted** attributes. The gap is what makes scouting-department quality matter.

## Three populations, same model

- **Prospects** — a consensus 1st-round pick may have true attributes of a late-round player (bust). A Day-3 prospect may have true attributes of a multi-year starter (gem).
- **Coaching candidates** — a decorated candidate may have poor true ratings on metrics that drive team performance. An unheralded coordinator may grade out as elite.
- **Scouting candidates** — a well-networked scout may have a high noise floor on talent evaluation. A young scout may grade out as a positional specialist.

## Mechanics

1. **Two stored vectors per subject.** DB stores **true** (used by sim) and **scouted / public** (shown to user) attribute vectors. Noise is position-, role-, and context-dependent. Scouted vector converges on true as scouting work accumulates.

2. **Fat-tailed noise distribution.** Most candidates are close to consensus. A meaningful minority are multiple tiers off. Gaussian noise produces a boring market; fat tails produce busts and gems.

3. **Consensus is aggregated from NPC scouting.** The public board is built from other teams' scouted outputs under their own quality constraints. Consensus errors follow patterns (e.g., overweighting measurables, underweighting small-school production).

4. **Scout quality reduces noise.** The DoS + scouting department produces a lower-variance estimator of the true vector than the public signal, within the department's archetype coverage (see [`archetypes.md`](./archetypes.md)).

5. **Verdicts are delayed.** The sim does not expose truth at the point of decision. Truth surfaces through on-field results, development outcomes, and aging. This is a product constraint: no "you missed a gem" signal at draft time.

6. **NPC GMs share the noise model.** Other franchises draft busts and miss gems. This creates mispricing in trade and FA markets.

## Implication

The user's information advantage is whatever their scouting department produces beyond the public signal. Hiring the right archetype mix in the department is how that advantage is built.

## Related

- [`player-attributes.md`](./player-attributes.md)
- [`archetypes.md`](./archetypes.md)
- [`scarcity-economy.md`](./scarcity-economy.md)
