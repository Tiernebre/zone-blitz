# Simulation Engine

The simulation engine produces a full play-by-play NFL game from two teams'
rosters and scheme fingerprints. Every game is deterministic — given the same
seed, roster, and scheme inputs, the engine produces identical output.

## Architecture at a Glance

```
simulateSeason
  for each scheduled matchup:
    simulateGame(home, away, seed)
      Opening kickoff
      for each quarter (Q1-Q4, OT if tied):
        while clock > 0:
          runPlay()
            resolvePlay(state, offense, defense, rng)
              drawOffensiveCall  → OffensiveCall
              drawDefensiveCall  → DefensiveCall
              resolveMatchups    → Matchup[]
              rollMatchup (each) → MatchupContribution[]
              synthesizeOutcome  → PlayEvent
            handleScoring / handleTurnover / advanceDowns
      computeBoxScore, deriveDriveLog, deriveInjuryReport
```

All source files live in `server/features/simulation/`.

---

## Entry Points

### `simulate-season.ts` — Season Orchestration

`simulateSeason({ leagueSeed, teamCount, gamesPerTeam })` builds a round-robin
schedule from synthetic teams, then calls `simulateGame` for each matchup. Each
game's seed is derived deterministically via
`deriveGameSeed(leagueSeed,
gameId)`, so every game in the season is
reproducible from the single league seed.

### `simulate-game.ts` — The Game Loop

`simulateGame({ home, away, seed, gameId?, isPlayoff? })` is the heart of the
engine. It accepts two `SimTeam` objects (roster + scheme fingerprint + coaching
modifiers) and a numeric seed.

**`SimTeam` shape:**

```ts
{
  teamId: string;
  starters: PlayerRuntime[];
  bench: PlayerRuntime[];
  fingerprint: SchemeFingerprint;
  coachingMods: CoachingMods;
}
```

---

## Game State

The loop maintains a `MutableGameState` with:

| Field                           | Description                                 |
| ------------------------------- | ------------------------------------------- |
| `quarter`                       | 1-4 (or 5+ for OT)                          |
| `clock`                         | Seconds remaining in the quarter            |
| `possession`                    | `"home"` or `"away"`                        |
| `yardLine`                      | 0-100 (own goal line = 0, opponent's = 100) |
| `down`                          | 1-4                                         |
| `distance`                      | Yards to first down                         |
| `homeScore` / `awayScore`       | Running totals                              |
| `driveIndex` / `playIndex`      | Counters for event sequencing               |
| `homeTimeouts` / `awayTimeouts` | Reset to 3 at halftime                      |

### Clock Constants

| Constant            | Value            |
| ------------------- | ---------------- |
| `QUARTER_SECONDS`   | 900 (15 minutes) |
| `SECONDS_PER_PLAY`  | 34.8             |
| `OT_SECONDS`        | 600 (10 minutes) |
| `TIMEOUTS_PER_HALF` | 3                |

### Clock Mechanics

- Non-stopping plays burn 34.8 seconds.
- Clock-stopping plays (incomplete pass, penalty, score, turnover, timeout) burn
  5-15 seconds randomly.
- The clock stops on: incomplete pass, spike, penalty, turnover, timeout,
  touchdown, field goal, missed FG, punt, kickoff, safety, return TD.

---

## Play Dispatch (`runPlay`)

Each iteration of the inner loop runs through this sequence:

1. **Kneel check** — If leading in Q2/Q4 with enough clock to run out via kneels
   (remaining downs x 40s), emit kneel events.
2. **Fourth-down check** — If 4th down, call `resolveFourthDown` for the
   punt/FG/go decision. Punt and FG resolve immediately; "go" falls through to
   normal play resolution.
3. **Build team runtimes** — Filter injured players out of active rosters.
4. **Resolve the play** — Call `resolvePlay` to get a `PlayEvent`.
5. **Two-minute drill** — Tag events, handle probabilistic timeout spending
   (offense trailing: 40% chance, defense leading: 30% chance).
6. **Injury roll** — 0.5% chance per play. Severity is weighted: shake-off
   (35%), miss-drive (25%), miss-quarter (15%), miss-game (10%), miss-weeks
   (8%), miss-season (5%), career-ending (2%).
7. **Apply penalties** — Adjust field position and down/distance for accepted
   penalties.
8. **Handle scoring** — Award points for TDs, field goals, safeties. Trigger
   PAT/2-pt conversion after every TD, then kickoff.
9. **Handle turnovers** — Switch possession, start new drive at the inverted
   yard line.
10. **Advance downs** — Update yard line, increment or reset down and distance.

---

## Play Resolution (`resolve-play.ts`)

`resolvePlay(state, offense, defense, rng)` is a five-step pipeline:

### Step 1: Draw Offensive Call

`drawOffensiveCall(fingerprint, situation, rng)` picks a concept, personnel
grouping, formation, and motion.

**Run/pass decision:**

- Base run probability = `(100 - runPassLean) / 100 + 0.07`
- Adjustments:
  - +0.15 for short yardage (3rd/4th and 3 or fewer)
  - -0.08 for long yardage (7+)
  - -0.20 for two-minute drill
- Clamped to [0.15, 0.85]

**Run concepts:** `inside_zone`, `outside_zone`, `power`, `counter`, `draw`
(plus `rpo` if `rpoIntegration > 60`).

**Pass concepts:** `screen`, `quick_pass`, `play_action`, `dropback`,
`deep_shot` (extra `deep_shot` weight if long yardage and `passingDepth > 50`).

### Step 2: Draw Defensive Call

`drawDefensiveCall(fingerprint, situation, rng)` selects front, coverage, and
pressure.

- **Front:** Nickel/dime in two-minute or if `subPackageLean > 65`; 3-4 if
  `frontOddEven < 40`, 4-3 if > 60, else coin flip.
- **Coverage:** Man-heavy (cover 0/1) if `manZone < 35`, zone-heavy if > 65,
  else random. Two-minute drill forces zone.
- **Pressure:** Base probability = `pressureRate / 100`, +0.15 on 3rd-and-long
  pass, -0.20 in two-minute.

### Step 3: Resolve Matchups

`resolveMatchups(call, coverage, offense, defense, rng)` pairs up individual
players into 1v1 battles. See the [Matchup Resolution](#matchup-resolution)
section below.

### Step 4: Roll Matchups

Each `Matchup` is scored via `rollMatchup`:

1. Average relevant attributes for attacker and defender (attribute keys vary by
   matchup type).
2. Apply scheme fit modifier: ideal (+10), fits (+5), neutral (0), poor (-5),
   miscast (-10).
3. Add `coaching.schemeFitBonus + coaching.situationalBonus` for each side.
4. Add situation modifier: +3 on 3rd-and-8+ for pass rush/protection, +2 in the
   red zone.
5. Add Gaussian noise N(0, 5), clamped to [-15, 15].
6. Final score = `attackerScore - defenderScore`, clamped to [-50, 50]. Positive
   means the attacker is winning.

### Step 5: Synthesize Outcome

Dispatches to `synthesizeRunOutcome` or `synthesizePassOutcome` based on the
offensive concept, then layers on:

- Safety detection (ball pushed behind own goal line)
- Touchdown detection (yardage reaches the end zone)
- Return TD roll on turnovers (2-8% probability based on defender speed)
- Penalty roll (1.7% per play)

---

## Matchup Resolution (`resolve-matchups.ts`)

### Run Plays

- **Blockers:** O-linemen, tight ends, running backs — ranked by blocking
  attributes.
- **Defenders:** Interior D-linemen, edges ranked by run defense, then
  linebackers.
- Paired 1-to-1 up to `min(blockers, defenders)` as `run_block` matchups.

### Pass Plays

Three layers of matchups are created:

1. **Pass protection:** O-linemen vs edges and interior D-linemen →
   `pass_protection` matchups.
2. **Blitz pickup:** If pressure is beyond a four-man rush, linebackers vs
   running backs → `pass_rush` matchups.
3. **Route/coverage:**
   - **Man coverage** (cover 0/1): Receivers (WRs + TEs) vs cornerbacks and
     safeties → `route_coverage` matchups.
   - **Zone coverage:** Uses `ZONE_DEPTH_PRIORITY` tables keyed by coverage
     shell and receiver route depth (short/medium/deep, derived from the pass
     concept). Defenders are assigned without reuse.

---

## Outcome Synthesis

### Run Outcomes (`synthesize-run-outcome.ts`)

Computes a `blockScore` from the average of all `run_block` and `run_defense`
contribution scores, then maps to a yardage band:

| Block Score | Band     | Yardage |
| ----------- | -------- | ------- |
| < -20       | Stuff    | -3 to 0 |
| < -5        | Short    | 1 to 5  |
| > 15        | Big play | 9 to 26 |
| else        | Normal   | 2 to 8  |

- **Fumble:** 0.9% chance. Sets outcome to `"fumble"`.
- Tags `"first_down"` if yardage meets or exceeds the distance to gain.

### Pass Outcomes (`synthesize-pass-outcome.ts`)

1. **Protection score** = average of `pass_protection` + `pass_rush`
   contributions.
2. **Sack roll:** Probability = `max(0.01, 0.086 - protectionScore * 0.005)`.
   Sack yardage: -10 to -3. 8% fumble chance on sacks.
3. If no sack:
   - **Pressure tag** added if `protectionScore < -5`.
   - **Coverage score** = average of `route_coverage` contributions.
   - **Interception:** `max(0.004, 0.022 - coverageScore * 0.002)`
   - **Completion:** `max(0.18, min(0.92, 0.655 + coverageScore * 0.010))`
   - **Big play:** `max(0.05, min(0.45, 0.20 + coverageScore * 0.008))`
4. A single roll determines: interception → completion (big/normal) →
   incomplete.
   - Big play yardage: 13-35 yards
   - Normal completion: 3-14 yards

---

## Special Teams

### Kickoff (`resolve-kickoff.ts`)

Decision tree evaluated in order:

1. **Onside kick** — If trailing in Q4/OT with 5 or fewer minutes left. 12%
   recovery rate.
2. **Out-of-bounds** — 3% chance. Ball at the 40.
3. **Squib** — 5% chance. 5-15 yard return from the 30.
4. **Touchback** — Based on kicker's `kickingPower` (20% at power=30, 85% at
   power=100).
5. **Full return** — Yardage based on returner speed/elusiveness vs coverage
   speed/tackling. Return TD probability: 1.5-2.5%.

Safety kicks start from the 20-yard line.

### Punt (`resolve-punt.ts`)

- **Distance:** Gaussian distribution based on punter power and accuracy. Range:
  20-65 yards.
- **Outcome decision tree:**
  1. Block — `max(0.005, 0.03 - (accuracy/100) * 0.025)`
  2. Muff — `0.02 + (1 - agility/100) * 0.03`
  3. Touchback — If the ball lands at or past the end zone.
  4. Downed inside 10 — `0.3 + (accuracy/100) * 0.3` chance when landing inside
     the 10.
  5. Fair catch — `max(0.1, min(0.7, 0.3 + coverageBonus))`
  6. Return — Remaining cases. Yardage via Gaussian based on returner vs
     coverage.

### Field Goal (`resolve-field-goal.ts`)

Distance = `100 - yardLine + 17` (17-yard snap distance).

Block chance: `max(0.005, 0.04 - (accuracy/100) * 0.02 - (power/100) * 0.01)`.

**Success probability by distance:**

| Distance    | Base Rate | Accuracy Bonus | Power Bonus |
| ----------- | --------- | -------------- | ----------- |
| 27 or fewer | 0.90      | +0.08          | —           |
| 28-37       | 0.80      | +0.12          | —           |
| 38-47       | 0.65      | +0.15          | +0.05       |
| 48-52       | 0.45      | +0.20          | +0.10       |
| 53+         | 0.30      | +0.15          | +0.15       |

All probabilities clamped to [0.01, 0.99]. On a miss, the defense gets the ball
at `max(20, 100 - yardLine)`.

---

## Fourth-Down Decisions (`resolve-fourth-down.ts`)

The engine maps the current field position to a zone and the distance to gain to
a bucket, then looks up a base go-for-it rate:

**Field zones:** own deep, own 40-to-50, opponent 40-to-50, opponent 30-to-40,
opponent red zone outer, opponent red zone inner.

**Distance buckets:** short (1-2), medium (3-5), long (6+).

A `BASE_GO_RATES` matrix provides the raw probability (e.g., own deep / short =
25.3%, opponent 30-40 / short = 80.5%).

**Modifiers:**

- **Coach aggressiveness:** Multiplied by `0.5 + aggressiveness / 100` (range
  ~0.5-1.2).
- **Late-game urgency:** Up to +0.30 boost based on point deficit (capped at 21)
  and time remaining.

If the roll says don't go: attempt a field goal if `yardsToEndzone + 17 <= 55`,
otherwise punt.

---

## Penalties (`resolve-penalty.ts`)

### Occurrence

1.7% chance per play.

### Catalog

15 penalty types split into pre-snap and post-snap:

**Pre-snap (always accepted):** false start, delay of game, offsides,
encroachment, neutral zone infraction.

**Post-snap offense:** holding (highest weight), offensive pass interference,
illegal block in the back, illegal use of hands.

**Post-snap defense (all carry automatic first down):** defensive holding,
defensive pass interference, facemask, roughing the passer, unnecessary
roughness, illegal contact.

### Selection

- Penalties are weighted. If no on-field player matches the penalty's position
  tendencies, weight drops by 90%.
- DPI gets a 1.5x weight boost on pass plays; holding gets 1.3x on run plays.
- A specific player is selected as the offender based on position matching.

### Acceptance

- Pre-snap penalties are always accepted.
- Post-snap against offense: defense accepts if the play gained positive yardage
  or a first down.
- Post-snap against defense: offense accepts if the play lost yardage, or the
  penalty gives an automatic first down the play didn't achieve, or penalty
  yardage exceeds play yardage.

---

## Scoring (`scoring.ts`)

| Event                | Points         | What happens next              |
| -------------------- | -------------- | ------------------------------ |
| Touchdown            | 6              | PAT/2-pt attempt, then kickoff |
| Field goal           | 3              | Kickoff                        |
| Safety               | 2 (to defense) | Safety kick from the 20        |
| Extra point          | 1              | —                              |
| Two-point conversion | 2              | —                              |
| Return TD            | 6 (to defense) | PAT/2-pt attempt, then kickoff |

### PAT vs Two-Point Decision

The engine always attempts a two-point conversion when:

- Trailing by 2 in Q4
- Trailing by 8
- Trailing by 15 in Q3+

Otherwise, it attempts two points if coach aggressiveness is high enough (80+ in
Q4, 92+ otherwise). Default is an extra point.

### Extra Point Resolution

Success rate: `max(0.80, min(0.99, 0.88 + (accuracy - 30) * (0.10/60)))` —
roughly 88-98% based on kicker accuracy.

### Two-Point Resolution

Calls `resolvePlay` at 1st-and-2 from the 98-yard line (2 yards out), then
applies a 50% "goal-line compression" factor on top. Overall success rate lands
around 48%.

---

## Events and Types (`events.ts`)

`PlayEvent` is the canonical record for every play:

```ts
{
  gameId: string;
  driveIndex: number;
  playIndex: number;
  quarter: number;
  clock: string;            // "M:SS" format
  situation: { down, distance, yardLine };
  offenseTeamId: string;
  defenseTeamId: string;
  call: OffensiveCall;
  coverage: DefensiveCall;
  participants: PlayParticipant[];
  outcome: PlayOutcome;
  yardage: number;
  tags: PlayTag[];
  penalty?: PenaltyInfo;
}
```

**`PlayOutcome`** — 16 variants: `rush`, `pass_complete`, `pass_incomplete`,
`sack`, `interception`, `fumble`, `touchdown`, `field_goal`,
`missed_field_goal`, `punt`, `penalty`, `kneel`, `spike`, `kickoff`, `xp`,
`two_point`, `safety`.

**`PlayTag`** — 29 tags covering scoring, turnovers, special teams, injuries,
and situational markers (e.g., `big_play`, `first_down`, `two_minute`,
`fourth_down_attempt`).

**`GameResult`** — The final output of `simulateGame`:

```ts
{
  gameId: string;
  seed: number;
  finalScore: { home: number; away: number };
  events: PlayEvent[];
  boxScore: BoxScore;
  driveLog: DriveSummary[];
  injuryReport: InjuryEntry[];
}
```

---

## Post-Game Derivation (`derive-game-views.ts`)

Three functions scan the `PlayEvent[]` array after the game ends:

- **`deriveBoxScore`** — Passing yards, rushing yards, total yards, turnovers,
  sacks, penalties for each team.
- **`deriveDriveLog`** — Groups plays by drive index, infers drive result
  (touchdown, field goal, punt, turnover, turnover on downs, end of half, etc.).
- **`deriveInjuryReport`** — Extracts injured players and their severity from
  injury-tagged events.

---

## RNG System (`rng.ts`)

### Mulberry32 PRNG

The engine uses `mulberry32`, a fast 32-bit PRNG. State advances as
`(state + 0x6D2B79F5) >>> 0` with multiplicative mixing. Output is a float in
[0, 1).

### `SeededRng` Interface

| Method                             | Description                               |
| ---------------------------------- | ----------------------------------------- |
| `next()`                           | Raw float [0, 1)                          |
| `int(min, max)`                    | Inclusive integer range                   |
| `pick(array)`                      | Random element from array                 |
| `gaussian(mean, stddev, min, max)` | Box-Muller transform, clamped and rounded |

### Seeding Strategy

- The league seed generates one RNG for team creation.
- Each game gets its own independent seed via
  `deriveGameSeed(leagueSeed,
  gameId)` — a Murmur-style hash mixing the league
  seed with the game ID string.
- All plays within a game share one `SeededRng` instance, consuming values
  sequentially.

---

## Season Aggregates (`season-aggregates.ts`)

`computeSeasonAggregates(results)` scans all events across all games and
produces league-wide averages:

- Plays per game, pass/rush percentage split
- Completion percentage, yards per attempt, yards per carry
- Sacks per team per game, turnovers per team per game
- Fourth-down go rate
- Average drive start yard line

Used by the calibration harness and seed sweep to verify statistical realism.

---

## Calibration Subsystem (`calibration/`)

A statistical validation harness used offline to verify the engine produces
NFL-realistic output. Not part of game logic.

- **Harness** (`harness.ts`) — Runs 1,344 games (half of the full 2,688 target
  games), collects per-team-per-game stats, then checks each metric against
  expected "bands" (ranges).
- **Three-gate check** (`three-gate.ts`) — Validates mean, standard deviation,
  and tail distribution for each metric.
- **Seed sweep** (`seed-sweep.ts`) — Runs the full season across multiple seeds
  and returns mean/stddev/min/max for every aggregate metric.
- **Band loader** — Parses a JSON band-definition file into metric targets.
- **Report formatter** — Produces human-readable calibration output.

---

## External Dependencies

### Player Attributes (`@zone-blitz/shared`)

47 attributes across physical (speed, acceleration, agility, strength...),
technical (arm strength, accuracy tiers, route running, tackling...), and mental
(football IQ, composure, clutch...) categories. Every attribute has a current
and potential value. See `docs/manual/player-attributes.md` for the full list.

### Scheme Fingerprint (`@zone-blitz/shared`)

Offensive tendencies: `runPassLean`, `tempo`, `personnelWeight`,
`formationUnderCenterShotgun`, `preSnapMotionRate`, `passingStyle`,
`passingDepth`, `runGameBlocking`, `rpoIntegration`.

Defensive tendencies: `frontOddEven`, `gapResponsibility`, `subPackageLean`,
`coverageManZone`, `coverageShell`, `cornerPressOff`, `pressureRate`,
`disguiseRate`.

### Scheme Fit (`server/features/schemes/fit.ts`)

`computeSchemeFit` maps a player's attributes against the scheme fingerprint's
demands, producing a 0-100 score bucketed into: ideal, fits, neutral, poor,
miscast. This feeds directly into matchup scoring as the fit modifier.

### Neutral Buckets (`@zone-blitz/shared`)

Position classifications: QB, RB, WR, TE, OT, IOL, EDGE, IDL, LB, CB, S, K, P,
LS. Used for roster assignment, injury substitution (bench players with the same
neutral bucket are promoted), and matchup pairing.
