# 0023 — Sim football completeness: close the gap to real football

- **Date:** 2026-04-15
- **Status:** Proposed
- **Area:** game simulation — see
  [`../north-star/game-simulation.md`](../north-star/game-simulation.md)
  (especially
  [Football Completeness](../north-star/game-simulation.md#football-completeness));
  extends
  [`./0015-simulation-resolution-model.md`](./0015-simulation-resolution-model.md)
  and is calibrated by
  [`./0021-sim-calibration-harness.md`](./0021-sim-calibration-harness.md).

## Context

ADR 0015 committed the resolution model (play-by-play core, seeded RNG,
`PlayEvent` stream) and ADR 0021 committed the calibration harness that enforces
NFL-band fidelity on the sim's aggregates. Both sit on top of the v1 scope cut
in 0015 that explicitly deferred most of the rules-of-football surface: special
teams beyond a token punt/FG, two-minute drill, overtime, penalty mechanics,
defensive scores, and realistic field-position distributions.

The north-star has since been sharpened to state those deferrals are **not**
acceptable for a shippable sim — the
[Football Completeness](../north-star/game-simulation.md#football-completeness)
section names each as a floor requirement, not a stretch goal. The current
implementation in
[`server/features/simulation/`](../../../server/features/simulation/) still
reflects 0015's v1 slice and falls short of that floor in concrete, enumerable
ways:

- **4th-down decisioning is a lookup table** (`simulate-game.ts:301`): punt or
  FG based on field position only, with no coach-aggressiveness input and no "go
  for it" branch — the `yardsToEndzone ≤ 2` case returns false into an
  already-consumed down, so 4th-and-goal behaviour is undefined rather than
  modeled.
- **Touchdowns hardcode 7 points** (`simulate-game.ts:268`) — no XP attempt, no
  2-point decision or resolution, no missed XPs.
- **Drives always start at the 25** (`simulate-game.ts:272,297,361,408`) —
  kickoffs are never emitted, there is no return game, no onside mechanic, and a
  missed FG hands the defense the ball at the kick spot rather than the spot of
  the kick.
- **Safety logic is dead code** (`simulate-game.ts:276`) — nothing in
  `synthesizeOutcome` ever emits the `safety` tag, so the branch never fires.
- **Defensive scores don't exist** — interception and fumble events
  (`resolve-play.ts:460,516,553`) set yardage to `0` and flip possession at the
  spot; there is no pick-6, fumble-6, blocked-kick-return TD, or FG-block
  recovery.
- **Penalties are a 5% cosmetic tag** (`resolve-play.ts:586`) with no yardage,
  no down impact, no accept/decline, no pre-snap vs. post-snap distinction, and
  no ability to negate a long play.
- **No overtime** — the quarter loop (`simulate-game.ts:471-490`) stops after Q4
  regardless of score, so ties just stand and the `"OT"` quarter value on
  `PlayEvent` is unreachable.
- **No clock management** — there are no timeouts, no two-minute tempo shift, no
  kneel-downs; a leading offense with the ball at 0:30 still runs a normal play
  call.
- **Matchups pair by array index** (`resolve-play.ts:301-344`) — there is no
  alignment or assignment model, so WR1 ↔ CB1 is an accident of roster order and
  individual stat concentration (RB1 load, WR1/WR2/TE target share) does not
  emerge.

Running the calibration harness (ADR 0021) on this engine would fit a curve to
the wrong game. The harness needs a sim that's resolving real football before
the bands are the only remaining source of drift.

## Decision

Commit the
[Football Completeness](../north-star/game-simulation.md#football-completeness)
section as **in-scope v1 for the sim**, and close the gaps above before the
calibration harness is considered truthful. This ADR upgrades 0015's deferral
list into implementation contracts; 0015's resolution-model commitments (single
engine, `PlayEvent` canonical, seeded determinism, attribute-driven matchups)
and 0021's band-enforcement contract are preserved unchanged.

Each gap is addressed as a discrete contract against the existing `PlayEvent` /
`GameResult` shape so that downstream consumers (Statistics, Media, Power
Rankings, the harness itself) keep reading the same stream.

### Scoring and conversions

- Touchdowns do not auto-award 7. A TD emits its `outcome: "touchdown"` event
  and then a follow-up **conversion event** (`outcome: "xp"` | `"two_point"`)
  resolved as its own play. XP is a kicker-attribute roll modulated by weather;
  2PT runs the full matchup pipeline from the 2-yard line. Missed XPs contribute
  to the box score.
- A `ConversionDecision` function — inputs: score differential, quarter, clock,
  HC aggressiveness — chooses XP vs. 2PT. Accepted 2PT rates land inside NFL
  bands across a harness sweep.
- **Safeties** fire from real triggers (tackle in the end zone, OL hold in the
  end zone, intentional grounding from the end zone, fumble out the back).
  Resolution emits `outcome: "safety"` with a 2-point defensive credit and
  switches to a free-kick drive start rather than reusing the touchback-at-25
  path.
- **Defensive touchdowns** — pick-6, fumble-6, blocked-kick return — are modeled
  as a post-turnover return resolution on the same play event, with a per-play
  return-TD probability driven by defender speed and open-field attributes.
  Defensive players accrue the TD on their box-score line.

### Special teams and field position

- **Kickoffs** are real events. Every score and the start of each half emits a
  `kickoff` event resolved from kicker leg strength, returner attributes, and
  coverage-unit attributes. Outcomes include touchback, return (with distance
  distribution), out-of-bounds, squib, and onside.
- **Onside kicks** are elected by trailing teams inside the final minutes at
  NFL-realistic rates (~10–15% recovery league-wide).
- **Punts** resolve to a distribution of outcomes (fair catch, return, downed
  inside the 10, touchback, muffed punt, blocked punt) — not a single random
  integer. Returner and coverage-unit attributes gate outcome weights.
- **Field goals** use a distance-dependent success curve keyed to kicker
  attributes and weather. Misses 50+ return to the spot of the kick; blocks live
  as recoverable returns. The `"pass_incomplete"+penalty` hack on a missed FG
  (`simulate-game.ts:354`) is removed.
- **Drive starting field position** is a distribution driven by the prior
  possession's outcome. The hardcoded `startNewDrive(25)` sites (punt, TD,
  turnover, FG) each feed into the kickoff/return or punt-return resolver that
  produces the actual starting spot.
- **Special-teams personnel** (gunners, upbacks, long snappers, returners) are a
  distinct depth-chart layer readable by the sim. The depth-chart UI surface
  belongs to a follow-up UI ADR; the sim-side contract is that per-role
  special-teams attributes are available at resolution time.

### 4th-down, two-minute, and clock management

- `handleFourthDown` becomes a `resolveFourthDown(state, coach)` decision
  function: inputs are field position, distance, score differential, time
  remaining, HC aggressiveness, and win-probability delta across {go, FG, punt}.
  A "go for it" branch resolves as a normal offensive play; failure hands the
  ball over at the dead-ball spot.
- **Two-minute drill** — inside two minutes of each half, the offense shifts to
  a hurry-up tendency (more pass, sideline-breaking routes, clock-stopping
  plays). The defense mirrors with prevent-adjacent coverage weighting.
- **Timeouts** become a finite per-half resource on team state. Both offenses
  (trailing, needing to stop the clock) and defenses (stopping the offense from
  bleeding clock) spend them via coach-attribute-gated decisions. Timeout usage
  is emitted in the event stream for second-guessing.
- **Kneel-downs and victory formation** — leading teams with the ball and enough
  clock end the game without running real plays; resolution emits
  `outcome: "kneel"` events that burn appropriate clock and do not generate
  box-score statistics.

### Overtime

- The game loop extends past Q4 into an explicit `"OT"` period when the score is
  tied. Regular-season OT follows current NFL rules (10-minute period, both
  teams get a possession unless the first drive produces a TD, ties permitted);
  playoff OT plays to a winner.
- `GameState.quarter === "OT"` (already on the type) becomes reachable; the
  outer loop in `simulate-game.ts` gains an OT branch rather than ending at
  `q === 4`.

### Penalties

- Penalties become real events, not cosmetic tags. Each penalty has a type
  (false start, offside, delay of game, holding, PI, facemask, roughing, illegal
  block, etc.), yardage, automatic-first-down flag, and pre-snap/post-snap
  classification per NFL rules.
- Post-snap penalties emit the original play event plus a paired `penalty`
  event; the non-penalized team chooses **accept or decline** based on a simple
  optimality heuristic (prefer the better field position / down-and-distance
  outcome). Declined penalties leave the original stats on the books; accepted
  ones negate the play's yardage and individual stats.
- Per-team penalty counts land inside NFL bands (~5–8 per team per game);
  individual flag accrual tracks position-appropriate tendencies (OL draws
  hold/false-start flags, DBs draw PI/holding flags, etc.).

### Matchup and assignment realism

- `identifyMatchups` moves off array-order pairing to an **alignment resolver**
  that assigns each offensive skill player a route tree / protection assignment
  from the call, and each defender a coverage responsibility (man target, zone
  area, rush gap) from the coverage. Matchups emerge from the intersection: a
  shutdown CB shadowing WR1 produces CB1-vs-WR1 every snap; a zone-heavy defense
  produces zone-based matchups where multiple receivers test the same defender
  across a drive.
- **Stat-concentration invariants** — carry share, target share, and snap share
  follow NFL distributions: RB1 absorbs most rushes over RB2/RB3; WR1/WR2/TE
  soak the majority of targets; CB1 draws the opposing WR1 enough to show up on
  the stat sheet. These are tested as part of the calibration harness, not just
  the play-by-play resolution.

### Event-shape additions

No breaking changes to `PlayEvent`. New outcome values (`"xp"`, `"two_point"`,
`"safety"`, `"kneel"`, `"kickoff"`) and new tag values (`"onside"`, `"muff"`,
`"return_td"`, `"blocked_kick"`, `"accepted_penalty"`, `"declined_penalty"`,
`"negated_play"`, `"two_minute"`, `"victory_formation"`) extend existing union
types. Existing event consumers continue to read the same shape; new consumers
(conversion stats, timeout usage, OT win distribution) layer on derived views
over the same stream, matching 0015's derived-views principle.

### Relationship to the calibration harness

Each completeness addition ships with a calibration target. The harness from ADR
0021 already fails PRs that drift team-game aggregates out of band; this ADR
expands the set of checked metrics to include:

- 2PT attempt rate, XP success rate, FG success by distance
- Onside-kick recovery rate, return-TD rate, average drive start
- 4th-down go-for-it rate (overall and by coach aggressiveness tier)
- Penalty counts per team per game, accept-rate on post-snap flags
- OT frequency in regular season, playoff OT length distribution
- Target / carry concentration (top-1, top-3, top-5 share per team)

Bands for metrics not yet generated from `nflfastR` (conversion rates,
special-teams outcomes, concentration shares) are follow-up work for the data
pipeline under `data/`. The three-gate tolerance policy from 0021 applies
unchanged.

## Alternatives considered

- **Keep 0015's v1 deferral list and calibrate what we have** — rejected. The
  north-star explicitly calls this floor "not a stretch goal." Calibrating
  against the current engine produces numbers that _look_ NFL-shaped (yards,
  completions, turnovers) while hiding that no team ever went for it, no penalty
  ever negated a play, and no game ever went to overtime. That is the
  box-score-realism-without-football-realism failure mode the north-star names
  directly.
- **Treat each gap as its own ADR (Special Teams ADR, Penalties ADR, Overtime
  ADR, 4th-Down ADR)** — rejected. They share one event shape, one clock, one
  calibration harness, and one coherent definition of "what counts as a real
  game." Splitting invites partial merges where the sim is internally
  inconsistent for weeks (kickoffs exist but drives still start at 25; penalties
  have yardage but no accept/decline). A single ADR lets implementation slice by
  work item while the contract stays whole.
- **Defer until after the calibration harness lands fully-green** — rejected.
  The harness needs the football-completeness events to exist before its band
  set is meaningful (2PT rate, onside rate, OT frequency). Ordering completeness
  _after_ green calibration would either require disabling half the checks or
  fabricating events the sim doesn't emit. Completeness and calibration land on
  top of each other.
- **Model from nflfastR play-by-play directly (replay a distribution of real
  plays)** — rejected for the same reason 0015 and 0021 rejected sampling from
  the oracle: no attribute-driven causality, no traceable link from roster
  decisions to game outcomes, and a detachment between "what the data says" and
  "what the attribute tuning implies."

## Consequences

- **Retires 0015's v1 deferral list.** Special teams, penalties, overtime,
  4th-down decisioning, and clock management move from "deferred" to "in-scope
  v1." ADR 0015 itself is unchanged — this ADR supersedes only the deferral
  paragraph.
- **Expands the calibration harness's band set.** ADR 0021's harness gains new
  assertions as the new events fire; the data pipeline under `data/` gains work
  to produce the corresponding `nflfastR` bands. Harness architecture is
  unchanged.
- **Unblocks Statistics, Media, and Awards.** Defensive TDs, 2-point
  conversions, overtime wins, and penalty stat lines all become derivable from
  the event stream they already consume.
- **Preserves ADR 0015 as-is.** The resolution model, determinism contract,
  event-stream canonicity, and single-engine commitment are unchanged; this ADR
  only fills in the v1 deferral list.
- **Expands the sim's surface area.** More code paths, more calibration targets,
  more seed-sensitivity. The mitigation is the harness from 0021 — drift shows
  up in CI, not in bug reports.
- **Special-teams personnel need a depth-chart home.** The sim contract says
  special-teams attributes are readable at resolution time; a follow-up UI ADR
  designs the depth-chart surface for gunners / upbacks / long snappers /
  returners. Until then, the sim reads a default role assignment derived from
  attributes.
- **Follow-ups not in this ADR:**
  - Special-teams depth-chart UI ADR
  - Weather / context modifiers ADR (feeds XP, FG, punt distributions)
  - Fatigue & momentum ADR (feeds two-minute / late-game resolution)
  - Live coaching overrides ADR (4th-down / timeout / 2PT user overrides against
    the decision functions defined here)
  - NPC game-planning ADR (opponent-specific adjustments on top of fingerprint)
  - `nflfastR` band generation for conversion rates, special-teams outcomes, and
    stat-concentration shares
