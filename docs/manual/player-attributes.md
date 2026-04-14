# Player Attributes — Reference

Flat, scannable catalog of every attribute the simulation tracks. Use this when
wiring scouting UIs, coaching development logic, sim weights, or any code that
needs to enumerate, display, or reason about individual attributes.

For the design rationale (0–100 scale, bell curve, hidden potential, no OVR,
progression rules), see
[`../product/north-star/player-attributes.md`](../product/north-star/player-attributes.md).
This document is the contract; that document is the _why_.

## Contract

- **Source of truth:**
  [`packages/shared/types/player-attributes.ts`](../../packages/shared/types/player-attributes.ts)
  — exports `PHYSICAL_ATTRIBUTE_KEYS`, `TECHNICAL_ATTRIBUTE_KEYS`,
  `MENTAL_ATTRIBUTE_KEYS`, `PERSONALITY_ATTRIBUTE_KEYS`, and the combined
  `PLAYER_ATTRIBUTE_KEYS` tuple. Import these — do not hard-code key lists.
- **Validation:**
  [`packages/shared/schemas/player-attributes.ts`](../../packages/shared/schemas/player-attributes.ts)
  exposes `playerAttributesSchema` (zod). Every field is `int 0–100`.
- **Type:** `PlayerAttributes` carries both the current rating and a hidden
  ceiling for every key — for every attribute `foo` there is a matching
  `fooPotential`. Same range, same constraint.
- **Persistence:** stored 1:1 with the parent row in `player_attributes` and
  `draft_prospect_attributes`. Each column is `smallint` with a DB-level
  `BETWEEN 0 AND 100` check constraint. Shapes stay in lockstep via a shared
  column builder — add an attribute in the shared tuple and both tables gain it.
- **Counts:** 7 physical + 26 technical + 9 mental + 6 personality = **48
  attributes**, each with a `*Potential` sibling, for **96 numeric fields per
  player**.
- **Visibility:** attributes are never shown to the user directly. Scouts and
  coaches surface filtered/biased reads; the sim consumes the raw values. See
  the north-star doc for the filtering model.

## Physical (7)

Raw athletic traits. Genetically constrained; age-sensitive; cannot be coached
past the potential ceiling.

| Key            | Meaning                                                           |
| -------------- | ----------------------------------------------------------------- |
| `speed`        | Straight-line top-end speed.                                      |
| `acceleration` | Burst off the line; how quickly top speed is reached.             |
| `agility`      | Change of direction, lateral movement, ability to cut.            |
| `strength`     | Raw power; moving or anchoring against opponents.                 |
| `jumping`      | Vertical leap and timing; contested catches, blocks, deflections. |
| `stamina`      | Endurance over a game; resistance to fatigue.                     |
| `durability`   | Resistance to injury; ability to absorb hits and stay healthy.    |

> `height_inches` and `weight_pounds` live on the parent `players` /
> `draft_prospects` row, not in the attributes table — they're physical traits,
> not 0–100 skills.

## Technical (26)

Learned skills. The primary axis of player development; most improvable through
coaching, reps, and stable scheme exposure.

### Passing

| Key                | Meaning                                                |
| ------------------ | ------------------------------------------------------ |
| `armStrength`      | How far and how hard the ball can be thrown.           |
| `accuracyShort`    | Precision within 15 yards.                             |
| `accuracyMedium`   | Precision between 15–30 yards.                         |
| `accuracyDeep`     | Precision beyond 30 yards.                             |
| `accuracyOnTheRun` | Precision while scrambling or rolling out.             |
| `touch`            | Arc and placement; lobs, back-shoulder, bucket throws. |
| `release`          | Quickness of the throwing motion.                      |

### Rushing / receiving

| Key                 | Meaning                                                 |
| ------------------- | ------------------------------------------------------- |
| `ballCarrying`      | Securing and protecting the ball in traffic.            |
| `elusiveness`       | Making defenders miss; jukes, spins, stiff arms.        |
| `routeRunning`      | Route precision; creating separation through technique. |
| `catching`          | Hands; cleanly securing the ball.                       |
| `contestedCatching` | Winning 50/50 balls; high-pointing, body positioning.   |
| `runAfterCatch`     | Gaining yards after the reception.                      |

### Blocking

| Key             | Meaning                                                     |
| --------------- | ----------------------------------------------------------- |
| `passBlocking`  | Pass-pro technique; anchor, hand placement, footwork.       |
| `runBlocking`   | Run-block technique; drive blocking, pulling, combo blocks. |
| `blockShedding` | Disengaging from blocks as a defender.                      |

### Defense

| Key            | Meaning                                                       |
| -------------- | ------------------------------------------------------------- |
| `tackling`     | Tackling technique and reliability.                           |
| `manCoverage`  | One-on-one coverage; mirroring, hip fluidity, recovery.       |
| `zoneCoverage` | Reading routes and defending zones; positioning, awareness.   |
| `passRushing`  | Getting to the QB; moves, counters, bend.                     |
| `runDefense`   | Setting the edge, filling gaps, assignment-sound run defense. |

### Special teams

| Key               | Meaning                                         |
| ----------------- | ----------------------------------------------- |
| `kickingPower`    | Leg strength for field goals and kickoffs.      |
| `kickingAccuracy` | Precision on field goal attempts.               |
| `puntingPower`    | Leg strength for punts; distance and hang time. |
| `puntingAccuracy` | Directional punting; pinning opponents deep.    |
| `snapAccuracy`    | Precision and speed of long snaps.              |

## Mental (9)

Cognitive and psychological makeup. Hardest to scout; highest surprise factor
once a player is on the roster.

| Key              | Meaning                                                       |
| ---------------- | ------------------------------------------------------------- |
| `footballIq`     | Reading defenses/offenses; scheme comprehension; adjustments. |
| `decisionMaking` | Choosing the right option under pressure.                     |
| `anticipation`   | Reading plays before they develop; throwing with timing.      |
| `composure`      | Emotional control; penalty/behavior resistance.               |
| `clutch`         | Performance in high-leverage moments.                         |
| `consistency`    | Game-to-game variance; gap between floor and ceiling.         |
| `workEthic`      | Hidden drive to improve; affects development rate.            |
| `coachability`   | Receptiveness to coaching and scheme/technique changes.       |
| `leadership`     | Impact on teammates' performance and morale.                  |

## Personality (6)

Off-field drivers. Do **not** affect on-field play outcomes — they shape
contract decisions, media response, locker-room fit, and free-agency behavior.
Hidden and hard to scout; inferred only through interviews, agent behavior, and
decision history.

| Key                | Meaning                                                     |
| ------------------ | ----------------------------------------------------------- |
| `greed`            | Weight money gets in decisions; drives bidding behavior.    |
| `loyalty`          | Attachment to current team; willingness to take a discount. |
| `ambition`         | Drive for championships; tolerance for joining contenders.  |
| `vanity`           | Desire for spotlight and big-market prestige.               |
| `schemeAttachment` | Preference for staying in a familiar system.                |
| `mediaSensitivity` | How much media coverage affects morale and behavior.        |

## Identity fields (on the parent row)

Not attributes, but part of the player record and often needed alongside them.

| Field          | Type       | Notes                                                |
| -------------- | ---------- | ---------------------------------------------------- |
| `heightInches` | `smallint` | Physical trait; interacts with speed/strength etc.   |
| `weightPounds` | `smallint` | Same.                                                |
| `college`      | `text?`    | Nullable; UDFAs and non-college paths have none.     |
| `birthDate`    | `date`     | Age is derived from the season clock — never mutate. |
