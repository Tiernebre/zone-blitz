# 0015 — Simulation resolution model: play-by-play core with fast-mode parity

- **Date:** 2026-04-15
- **Status:** Proposed
- **Area:** game simulation — see
  [`../north-star/game-simulation.md`](../north-star/game-simulation.md);
  consumes
  [`0007-coaching-scheme-implementation.md`](./0007-coaching-scheme-implementation.md)
  and the player-attribute model in
  [`../north-star/player-attributes.md`](../north-star/player-attributes.md);
  feeds [`../north-star/statistics.md`](../north-star/statistics.md)

## Context

Stats, media, injuries, player development, award races, and power rankings all
read from the simulation. None of those systems can be designed until the sim
commits to _what it produces_ and _at what granularity_. The north-star
describes the feel we want (NFL-accurate aggregates, two sim modes, per-play
event stream, attribute-driven outcomes) but no ADR fixes the resolution
approach, the pipeline, the output shape, or the v1 scope cut.

Three constraints bound the decision:

1. The north-star insists both sim modes produce **the same per-play event
   shape** so downstream stat categories never diverge by mode
   ([`statistics.md` — Sim requirements](../north-star/statistics.md#sim-requirements)).
2. The sim must consume **individual attributes, never an aggregate overall**,
   and must read scheme fingerprint / fit as pure functions from ADR 0007.
3. League-wide aggregates must land inside NFL historical bands
   ([`game-simulation.md` — NFL as the benchmark](../north-star/game-simulation.md#nfl-as-the-benchmark));
   game-level statistical models that sample box-score totals directly would
   satisfy the bands but fail the event-stream requirement.

## Decision

Ship a **play-by-play resolution core** as v1. Every simulated game — user
games, league games, deep-sims, history backfill — is resolved one play at a
time against a shared resolution pipeline. "Fast mode" in the north-star becomes
_the same engine run headless_ (no UI, no pauses, no live-coaching hooks, no
animation), not a parallel statistical model. A single code path keeps modes
statistically indistinguishable by construction rather than by calibration.

Each play is resolved by a deterministic pipeline seeded per game:

```
play call (OC/DC tendency draws)
  → matchup identification (offensive assignments × defensive assignments)
  → per-matchup attribute rolls (true attributes, not scouting views)
  → scheme-fit + coaching modifiers (from computeFingerprint / computeSchemeFit)
  → situation modifiers (down, distance, field position, weather, fatigue)
  → RNG draw against a weighted outcome distribution
  → PlayEvent (participants, outcome, yardage, situation, position-specific tags)
```

The `PlayEvent` stream is the sim's canonical output. Drive summaries, box
scores, and team totals are _derived views_ over the event stream, not parallel
records. Injuries, penalties, and turnovers are emitted as tags on the same
events.

### Resolution pipeline (sketch)

```ts
// server/features/simulation/resolve-play.ts
export function resolvePlay(
  state: GameState,
  offense: TeamRuntime, // roster slice + fingerprint + tendencies
  defense: TeamRuntime,
  rng: SeededRng,
): PlayEvent {
  const call = drawOffensiveCall(offense.fingerprint, state.situation, rng);
  const coverage = drawDefensiveCall(defense.fingerprint, state.situation, rng);
  const matchups = identifyMatchups(
    call,
    coverage,
    offense.onField,
    defense.onField,
  );

  const contributions = matchups.map((m) =>
    rollMatchup({
      attacker: m.attacker, // true attributes — hidden inputs
      defender: m.defender,
      schemeFitAttacker: computeSchemeFit(m.attacker, offense.fingerprint),
      schemeFitDefender: computeSchemeFit(m.defender, defense.fingerprint),
      coaching: {
        offense: offense.coachingMods,
        defense: defense.coachingMods,
      },
      situation: state.situation,
      rng,
    })
  );

  return synthesizeOutcome(call, coverage, contributions, state, rng);
}
```

`rollMatchup` is a weighted dot product of the relevant attributes for the
matchup type (pass-pro vs. pass-rush, route vs. coverage, block vs. shed) plus
modifiers, plus a bounded random perturbation. `synthesizeOutcome` collapses the
matchup contributions into a single `PlayEvent` with yardage, outcome, and any
tags (sack, pressure, target, INT, fumble, injury, penalty).

### Scheme and coaching as read-only consumers

ADR 0007 already defines `computeFingerprint(staff)` and
`computeSchemeFit(player, fingerprint)`. The sim **consumes both as pure
functions**; it does not re-propose a model, does not cache fit, and does not
persist a derived scheme on the team. Coach tendency vectors drive play-call
distributions (e.g. `runPassLean` biases `drawOffensiveCall`'s split;
`pressureRate` biases `drawDefensiveCall`'s blitz probability). HC overrides
enter at situational decision points (4th-down, two-minute, clock management).

### Hidden vs. visible attributes

The sim resolves plays against **true attributes** — the hidden engine values
described in [`player-attributes.md`](../north-star/player-attributes.md). User
surfaces (roster, scouting, broadcast spotlights) render scouting-gated views
and derived labels only. No sim input is sourced from a scouting projection; no
sim output leaks a hidden attribute. This isolation is what lets scouting ADRs
ship independently — the sim side is already settled.

### Determinism

Every game takes a `seed: number`. The game constructs a seeded RNG
(`mulberry32` or equivalent, same pattern ADR 0009 threads through the player
generator) and threads it through play resolution. Given the same roster, same
staff, same seed, a game is byte-identical on replay. Tests assert on fixed
seeds; league-wide tuning runs sweep thousands of seeds to validate aggregate
NFL bands. Parallel game simulation derives per-game seeds from a league seed so
a week of games is reproducible as a unit.

### What the sim emits (minimum viable output shape)

```ts
// server/features/simulation/events.ts
export type PlayEvent = {
  gameId: string;
  driveIndex: number;
  playIndex: number;
  quarter: 1 | 2 | 3 | 4 | "OT";
  clock: string; // "mm:ss"
  situation: { down: 1 | 2 | 3 | 4; distance: number; yardLine: number };
  offenseTeamId: string;
  defenseTeamId: string;
  call: OffensiveCall; // { concept, personnel, formation, motion }
  coverage: DefensiveCall; // { front, coverage, pressure }
  participants: PlayParticipant[]; // role, playerId, snap-level tags
  outcome: PlayOutcome; // "rush" | "pass_complete" | "sack" | "int" | ...
  yardage: number;
  tags: PlayTag[]; // injury, penalty, turnover, big-play, etc.
};

export type GameResult = {
  gameId: string;
  seed: number;
  finalScore: { home: number; away: number };
  events: PlayEvent[]; // canonical; everything below is derived
  boxScore: BoxScore; // team + player totals
  driveLog: DriveSummary[]; // start field pos, plays, yards, result
  injuryReport: InjuryEntry[];
};
```

`BoxScore`, `DriveSummary`, and `InjuryEntry` are intentionally _sketched_ — the
concrete stat schema belongs to a future Statistics ADR. This ADR commits only
to: events are canonical, derived views exist, and both modes populate the same
event shape.

### Performance target

Qualitative v1 bound: a full 272-game regular season simulates on the server in
**under 60 seconds** with the play-by-play engine running headless (no UI, no
event-stream serialization beyond what box scores need). That works out to
roughly 35,000 plays in under a minute — ~600 plays/sec, well within what a
typed attribute-dot-product pipeline can do in Deno on the droplet. If we miss
this bound, the first lever is trimming matchup fan-out (not switching to a
statistical fallback).

### v1 scope cut

v1 ships:

- Offense vs. defense matchups: passing, rushing, sacks, turnovers, penalties,
  scoring drives, punts, field goals (mechanical resolution only — no fake
  attempts, no onside kicks)
- Play-by-play resolution with the event stream described above
- Scheme fingerprint + fit consumed from ADR 0007 (OC + DC only, matching 0007's
  own v1 slice)
- Seeded RNG, reproducible games
- Derived box score + drive log
- Injuries as event tags with severity tier (no medical-staff modifiers, no
  rehab timeline logic — those belong to a future Injuries ADR)

v1 explicitly defers:

- Special teams beyond punt and FG mechanics (no return game modeling, no
  blocked kicks, no fakes)
- Weather, travel, rivalry, and playoff-pressure context modifiers
- Fatigue and momentum systems
- Live coaching overrides and the broadcast UI layer (the engine supports them;
  the surfaces don't ship in v1)
- Halftime adjustments and mid-season scheme-transition decay
- NPC game-planning (opposing coaches run their fingerprint with no
  opponent-specific tailoring)

## Alternatives considered

- **Game-level statistical sim (sample box-score totals from matchup
  distributions; fabricate events after the fact)** — rejected. Fast and easy to
  calibrate to NFL bands, but it violates the north-star's hard requirement that
  both modes emit the same per-play event stream. Reconstructing plausible
  events from sampled totals is the opposite direction of causation and would
  make every downstream system (award races, play-level advanced stats, live
  broadcast overlays) either lie or diverge between modes.
- **Drive-level hybrid (resolve each drive with a statistical model, synthesize
  a handful of plays per drive)** — rejected. Splits the difference and inherits
  the worst of both: drive-level models still need per-play fabrication for
  stats, and the fabrication tooling ends up being ~the play-by-play engine
  anyway, without the causal clarity. The implementation cost delta vs.
  committing to play-by-play is small; the correctness delta is large.
- **ML-trained outcome model (learn play distributions from NFL play-by-play
  data)** — rejected for v1. We have no training infrastructure, no ops story
  for model versioning in a deterministic sim, and no mechanism to keep "what
  the model learned" in sync with attribute tuning. Hand-authored weighted
  distributions are legible, testable, and directly traceable to attribute
  inputs; revisit ML as a tuning aid after v1 lands.
- **Two engines (statistical for non-user games, play-by-play for user games)
  sharing only a stat-schema contract** — rejected. The north-star is explicit
  that a game simulated fast and the same game simulated play-by-play should be
  statistically indistinguishable. Two engines makes that a calibration problem
  forever; one engine makes it true by construction.
- **Resolve on aggregate overall rating instead of individual attributes** —
  rejected. Contradicts the north-star directly ("The simulation consumes
  individual attributes — never an aggregate overall rating") and collapses the
  dimensions that make scheme fit and matchup context meaningful.
- **Use scouting-projected attributes as sim inputs when true attributes are
  "unknown"** — rejected. True attributes always exist (the generator writes
  them); "unknown to the user" is a _visibility_ concern, not a storage one.
  Routing the sim through scouting would couple resolution to UI-facing
  uncertainty and break reproducibility across scouting-investment levels.

## Consequences

- **Unblocks the Statistics ADR.** Stat schema can now be designed against a
  concrete `PlayEvent` stream with known fields.
- **Unblocks the Injuries ADR.** Injuries are already emitted as event tags with
  severity tier; the Injuries ADR designs the medical/rehab/durability model on
  top of that hook.
- **Unblocks the Player Development ADR.** Season-level progression reads from
  box scores + event participation (snap counts, targets, pressures) — all
  derivable from the event stream.
- **Unblocks the Media ADR.** Narrative generation reads from tagged events
  (big-play, game-winning drive, turnover-on-downs) rather than inventing a
  parallel highlight pipeline.
- **Unblocks the Power Rankings / Awards ADRs.** Both read from aggregated
  events; no new inputs are required.
- **Locks in a one-engine commitment.** We will not ship a second, statistical
  engine behind a feature flag. If the play-by-play engine is too slow for
  deep-sim use cases, the fix is optimization, not a second code path.
- **Reinforces ADR 0007's read-only scheme contract.** The sim is the first
  heavy consumer of `computeFingerprint` / `computeSchemeFit`; any performance
  pressure on those functions surfaces here.
- **Does not leak hidden attributes.** Sim inputs are true attributes; sim
  outputs are events and stats. Scouting visibility remains a view-layer
  concern.
- **Follow-ups not in this ADR:**
  - Statistics ADR — concrete `BoxScore` / `DriveSummary` / per-player stat
    schemas
  - Injuries ADR — severity tables, position risk profiles, medical staff
    effects, rehab timelines
  - Player Development ADR — attribute progression/regression driven by sim
    participation and age curves
  - Special Teams ADR — returns, fakes, onside kicks, field-position effects
  - Weather / Context Modifiers ADR — game-script inputs the v1 sim ignores
  - Fatigue & Momentum ADR — in-game state beyond down/distance/field position
  - Live Broadcast UI ADR — the presentation layer over play-by-play mode
  - NPC Game-Planning ADR — opponent-specific tendency adjustments
  - Sim Tuning Harness — seed-sweep tooling that validates league aggregates
    against NFL bands on every sim change

Each of the above warrants its own ADR before implementation.
