# Player attribute philosophy

How players are rated. Attributes feed the sim engine, contracts, draft boards, injuries, and aging.

## Principles

### 1. Every attribute must drive a sim lever

If no band in `data/bands/` changes in response to an attribute, the attribute doesn't exist. No decorative ratings.

### 2. Ratings are 0–100, centered on 50, absolute across positions

A 50 is the average pro at that position. The sim maps a 50 to the median of that position's statistical bands. No hidden position-specific multipliers.

Tier vocabulary (from [`data/docs/nfl-talent-distribution-by-position.md`](../../../data/docs/nfl-talent-distribution-by-position.md)):

| Tier        | Rating range |
| ----------- | ------------ |
| Replacement | sub-40       |
| Weak        | ~40s         |
| Average     | ~50          |
| Strong      | ~60–75       |
| Elite       | ~85+         |

Scarcity lives in the distribution, not in rating semantics. QB is bimodal, so few QBs are actually a 50; most are below. A 50 QB and a 50 RB produce comparably average output for their positions — there are just far fewer 50 QBs.

### 3. Position-specific distribution shapes

Player generation honors per-position shapes:

- **Bimodal (QB, TE-by-role)** — thin middle, fat tails. ~25–30% of QBs land in Average; the rest cluster above or below.
- **Top-heavy with long tail (EDGE)** — elite tier rare, middle deep, replacement thin.
- **Compressed toward middle (OL, S, K/P/LS)** — most players near 50, small spread.

Details in [`data/docs/nfl-talent-distribution-by-position.md`](../../../data/docs/nfl-talent-distribution-by-position.md).

### 4. Star concentration must match real NFL

`data/bands/position-concentration.json`: RB1 takes ~57% of team carries, WR1 ~38% of WR targets, QB1 ~81% of pass attempts. Player generation must produce within-team talent spreads that yield these concentrations under a realistic coach.

### 5. True ratings are hidden; scouted ratings are noisy estimates

DB stores two values per attribute: **true** (used by sim) and **scouted** (shown to user). Scouted signal has position-, scout-, and time-dependent noise. See [`busts-and-gems.md`](./busts-and-gems.md).

### 6. Ratings are time-indexed

Age shifts physical attributes on a position-specific curve (`data/bands/career-length.json`). Injuries can permanently reduce ratings (`data/bands/injuries.json`). Development under good coaching can raise ratings for young players.

### 7. Position-specific attribute sets

A QB's attributes (arm, accuracy short/deep, pocket presence, processing, mobility, durability) differ from an OL's (pass-set, run-block, anchor, leverage, durability). Each position's set is sized to cover every sim lever that position touches — no larger.

### 8. No overall rating

Not stored, not derived, not shown. A player is their attribute vector. The UI must compare players by attributes and role fit, not a composite number.

### 9. Ratings are bounded by real-NFL statistical reach

A max-rated rusher produces a YPC distribution within `data/bands/rushing-plays.json`. A max-rated QB completes passes within `data/bands/passing-plays.json`. Ceilings are set by real-NFL extrema.

## Related

- [`archetypes.md`](./archetypes.md)
- [`busts-and-gems.md`](./busts-and-gems.md)
- [`scarcity-economy.md`](./scarcity-economy.md)
