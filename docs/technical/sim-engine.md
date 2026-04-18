# Sim engine — design

Context handoff for future sessions. Captures decisions and their *why*. Does not restate charter content — see [`charter.md`](../product/north-star/charter.md), [`player-attributes.md`](../product/north-star/player-attributes.md), [`archetypes.md`](../product/north-star/archetypes.md), [`coach-schemes.md`](../product/north-star/coach-schemes.md), [`busts-and-gems.md`](../product/north-star/busts-and-gems.md), and the `data/bands/` bands.

If code and this doc disagree, read the code and update the doc. If the charter and this doc disagree, the charter wins.

---

## Scope

This doc covers the **game-simulation engine** only. In scope: play-level sim from kickoff to final whistle, calibrated against `data/bands/`. Out of scope here (tracked elsewhere): league/season orchestration, player generation, scouting noise model, coach/scout market, front-office UI. Assume the engine receives sane, pre-generated players and coaches.

---

## Architecture — two layers over a per-snap pipeline

The engine is a loop over snaps. Each snap runs a deterministic pipeline with exactly two RNG-consuming stages: **decide** then **resolve**. Keep the split — it's how calibration bugs localize.

### Per-snap pipeline

```
offPersonnel  = PersonnelCaller.offense(state, offCoach)
defPersonnel  = PersonnelCaller.defense(state, defCoach, offPersonnel)
onField       = Substitutions.resolve(roster, offPersonnel, defPersonnel, depthChart, fatigue, injuries)

offCall       = PlayCaller.call(state, offCoach, offPersonnel, defPersonnel)     // DECIDE
defCall       = DefensiveCaller.call(state, defCoach, offPersonnel, offCall)     // DECIDE

roles         = RoleAssigner.assign(offCall, defCall, onField)                   // pure
preSnap       = PenaltyModel.preSnap(roles, state, rng)                          // optional interrupt
if preSnap.present: emit and loop

outcome       = PlayResolver.resolve(roles, state, rng)                          // RESOLVE
penalty       = PenaltyModel.postSnap(roles, outcome, state, rng)                // optional
outcome       = PenaltyDecider.apply(outcome, penalty)                           // accept/decline, pure

clock         = ClockModel.advance(state, outcome, penalty)
state         = state.apply(outcome, penalty, clock)

emit(PlayEvent.from(offCall, defCall, outcome, penalty, clock))
```

Everything between `offCall` and `state.apply` is pure given the RNG. That means a recorded `(seed, state, calls)` triple replays to the same `PlayEvent`.

### Why this split

- **Bug localization.** Pass-rate-by-down off → decision layer. Completion-rate-under-pressure off → resolution layer. Different band files, different coefficients, different tests.
- **Swappable seams.** Scripted `PlayCaller` + real `PlayResolver` tests matchup math without coach noise. Real `PlayCaller` + deterministic `PlayResolver` tests play-calling against a known outcome surface.
- **Maps to mental model.** Coaches decide. Players execute. The code shape matches.

Not an "n-tier architecture" — two pure functions called per snap.

---

## Core seams (interfaces)

All interface types. Package-private inside `app.zoneblitz.sim` unless the public use case needs them. Constructor-injected. No concrete types in consumer code (ITDD).

| Interface | Responsibility | Key band(s) |
|---|---|---|
| `PersonnelCaller` | Pre-snap personnel (11/12/21, base/nickel/dime) | `play-call-tendencies.json` (personnel frequency) |
| `Substitutions` | Roster + depth chart + package → 11 on field | `position-concentration.json` |
| `PlayCaller` | Offensive play call given state + personnel | `play-call-tendencies.json`, `situational.json`, `red-zone-and-third-down.json` |
| `DefensiveCaller` | Defensive call given state + offense's personnel | `play-call-tendencies.json` (pressure rates, coverage mix) |
| `RoleAssigner` | Call → role assignment per player (blocker, rusher, route, coverage, …) | pure |
| `PlayResolver` | Roles + state + rng → `PlayOutcome` | `passing-plays.json`, `rushing-plays.json`, per-position bands |
| `TargetSelector` | QB target choice on pass plays (per-receiver matchup + QB-noised read) | `position-concentration.json`, `passing-plays.json` (air yards, depth mix) |
| `PenaltyModel` | Pre-snap and post-snap penalty sampling | `team-game.json`, per-position penalty rates, `penalties.json` (TBD, gap) |
| `PenaltyDecider` | Accept/decline — pure deterministic max-EV choice | pure |
| `FourthDownDecider` | Go / punt / FG branch inside `PlayCaller` | `situational.json` (`fourth_down_go_rate`) |
| `FieldGoalModel` | FG attempt resolution (distance × accuracy × block) | `special-teams.json` |
| `ExtraPointModel` | PAT kick resolution | `special-teams.json` |
| `TwoPointModel` | 2pt attempt decision + one-play resolution | `situational.json` (`two_point_*`) |
| `PuntModel` | Punt resolution (distance, return, block) | `special-teams.json` |
| `KickoffModel` | Kickoff + onside resolution | `special-teams.json` |
| `ClockModel` | Per-play runoff + between-play clock + rules (2-min warning, 10s runoff) | emergent (plays-per-game) |
| `InjuryModel` | Per-contact injury sampling | `injuries.json`, `ir-usage.json` |
| `FatigueModel` | Snap-count accumulation + in-game physical decay | emergent (rotation patterns) |
| `BandSampler` | Canonical sampling from any band (rate or distribution) | all |
| `RandomSource` | Seeded RNG. Always. No `Math.random`, ever. | — |

Each seam calibrates against named band slice(s) — if a seam has no band target, question whether it should exist.

---

## Band sampling

Two band types. One pipeline.

### Rate bands

Categorical proportions. Sampled via weighted choice; matchup shifts weights in **log-odds space**:

```
logit(p') = logit(p_base) + Σ β_i × m_i
```

Renormalize over the outcome set to keep Σp = 1. `β` coefficients are **not derived** — they're tuned by the calibration harness. Logit not linear: keeps rates in [0, 1] at extremes, composes cleanly with multiple matchup inputs, matches how PBP regressions behave.

### Distributional bands

Shape-of-continuous-value. Stored as percentile ladder (`p10, p25, p50, p75, p90`, `min`, `max`). Sampled by **percentile inversion**:

```
u         = rng.uniform(0, 1)
u_shifted = clamp(u + γ × m, ε, 1 - ε)
value     = interpolatePercentiles(band, u_shifted)
```

Matchup shifts *where on the distribution* we land; the curve's shape is preserved. `min` / `max` pin ceiling/floor for free — satisfies [`player-attributes.md`](../product/north-star/player-attributes.md) principle 9 without manual clamps.

Parametric distributions (log-normal, gamma) are a fallback if percentile interpolation tails misbehave. Default to percentiles — yardage distributions are visibly non-normal (completion yards `mean=10.96, sd=9.86, p10=2, max=98`, heavily right-skewed).

### `BandSampler` as the single chokepoint

Every band consumer routes through `BandSampler`. Makes coefficient tuning a one-place change, makes recording/replaying samples trivial, keeps the sampling math auditable.

---

## Matchup math

The core move: **role-based aggregates**, **physical profile fit gates skill**, **tendencies modulate in context**.

### Role-based, not position-based

Role is assigned **per snap** by the play call, not by the depth chart. A corner blitz moves that CB into the rushers bucket (contributing pass-rush attributes) and out of the coverage bucket. Max protect moves an RB into blockers (contributing pass-block attributes). Two pass-play sub-rolls regardless:

```
m_pass_rush = aggregate(rushers,      pass_rush_axes)  − aggregate(blockers,          pass_block_axes)
m_coverage  = aggregate(route_runners, route_axes)     − aggregate(coverage_defenders, coverage_axes)
```

Pass-rush wins resolve toward sack / pressured throw. Coverage is the outer shape — per-receiver matchups and target selection live inside it (see [Pass-play resolution detail](#pass-play-resolution-detail)). Blitz tradeoff (more rushers → `m_pass_rush` up, fewer coverage defenders → per-receiver matchups up) falls out mechanically — no special-cased rules.

### Run plays — same shape

```
m_run_block = aggregate(blockers,    run_block_axes) − aggregate(run_fit_defenders, run_fit_axes)
m_ball_carrier = aggregate(ball_carrier, tackle_break_axes) − aggregate(tacklers, tackling_axes)
```

Block roll decides if yards open up; ball-carrier roll decides YAC past first contact.

### Pass-play resolution detail

The single `m_coverage` aggregate is a lie of omission. A pass play has up to ~5 route runners; the QB picks one. Collapsing them loses per-receiver stats (`position-concentration.json` target shares, slot vs boundary breakdowns, archetype stat profiles). Target selection is its own sub-step.

Pass-play branch inside `PlayResolver`:

```
1. Pass-rush sub-roll → pressure level ∈ {clean, pressured, sacked, scrambled}
2. If sacked / scrambled: resolve and return (yardage from passing-plays bands)
3. Per-receiver matchups (one per route runner):
     m_route_i = aggregate(receiver_i, route_axes) − aggregate(assigned_coverage_i, coverage_axes)
     same physical-clamp + tendency modulation as the general matchup math
4. Target selection → TargetChoice (see below)
5. Per branch:
     Throw(receiver, depth)    → throw-quality → completion roll → catch roll → YAC roll
     Scramble | Throwaway      → resolve from passing-plays bands (scramble_yards etc.)
```

`TargetSelector` chooses via weighted selection over receivers with QB-introduced noise on perceived openness:

```
actual_openness_i    = m_route_i + depth_value(route_i) − time_penalty(depth_i, pressure)
perceived_openness_i = actual_openness_i + rng.gaussian(0, σ(qb.processing, qb.footballIq))
progression_bias_i   = progressionWeight(i, playCall)       // primary > secondary > checkdown
tendency_bias_i      = tendencyShift(qb.archetype, depth_i) // gunslinger +deep, game manager +shallow

score_i = perceived_openness_i + progression_bias_i + tendency_bias_i

if max(score_i) < throwThreshold(qb, pressure): Scramble | Throwaway | Sack
else:                                            Throw(argmax(score_i), depth)
```

Emergent behaviors this produces (**no special cases for any of these**):

- **High-IQ QB.** Low σ → finds the actually open receiver. High checkdown rate under tight coverage. High completion %.
- **Low-IQ QB.** High σ → misreads. Forces primary or throws into safety help. INTs on miscoverage reads.
- **Gunslinger archetype.** `tendency_bias` pushes deep → higher air yards, lower completion %, more 20+ plays, more INTs.
- **Pressure forces shallow.** `time_penalty` scales with depth, so pressure sharply negates deep perceived_openness → selector picks checkdown or scrambles.
- **Per-receiver matchup drives target share.** A weak slot CB lifts slot `m_route` → QB finds the slot more often. Slot-heavy offenses emerge from scheme × matchup, not a dial.

Completion roll uses the **selected receiver's** matchup, not the aggregate:

```
throw_quality = qb.accuracy_at_depth(depth) × composureShift(situation) − pressurePenalty(pressure)
completion_m  = m_route_target + throw_quality − contestedCatch(assigned_coverage_target)
complete      = bandSampler.rate(passing-plays.completion_rate_by_depth[depth], completion_m)
```

Air yards are an **emergent** calibration target — route depth distribution falls out of what `TargetSelector` picks, so simulated `air_yards_all_targeted.p75` drifting high means the selector's picking too many deep routes (wrong σ, wrong tendency bias, or wrong time_penalty curve).

`TargetChoice` is a sealed union — `Throw(receiverId, depth) | Scramble | Throwaway | Sack`. `PlayResolver` branches to resolution paths per variant. `TargetSelector` is its own package-private seam under `app.zoneblitz.sim`.

**New calibration assertions:**
- Target distribution per position reproduces `position-concentration.json` (WR1 ~38% of WR targets, TE1 ~52% of TE targets) without tuning.
- Per-archetype air-yard distributions match scouting reality (gunslinger p75 vs game-manager p75 diverge as expected).
- INT rate decomposes correctly — mostly from low perceived_openness (tight windows) and low-IQ forced throws, not uniform-random miscues.
- Checkdown-rate-vs-pressure curve matches (needs `bigdatabowl` priors — flagged in gaps).

### Three attribute families compose the aggregates

Split the attribute vector into three record sub-fields:

**`Physical`** — speed, acceleration, agility, strength, power, bend, stamina, explosiveness. 0–100, performance capacity.

**`Skill`** — technique attributes per domain (pass_set, route_running, tackling, coverage_technique, pass_rush_moves, hands, pocket_presence, block_shedding, …). 0–100.

**`Tendencies`** — composure, discipline, football_iq, processing, toughness, clutch, consistency, motor. 0–100, behavioral knobs applied contextually.

Vector is **uniform across all positions**. A CB carries every attribute; most cross-role attributes sit near 0. See "attribute floor" below.

### Physical profile fit gates skill

A role has a **physical profile** — a weighted vector saying which physical attributes matter and how much. Every player has a `physicalScore(role)` computed as a weighted sum of their physical attributes against the role's profile, centered and scaled.

Physical gap creates a **window** within which skill can move the matchup:

```
physical_gap = off_physical_score(role) − def_physical_score(role)

floor   = −1.0 + 0.5 × max(0, physical_gap)
ceiling = +1.0 + 0.5 × min(0, physical_gap)

m_skill_raw = off_skill_aggregate − def_skill_aggregate
m_clamped   = clamp(m_skill_raw, floor, ceiling)
```

Skill delta moves you *inside* the window. Cannot escape it. This is the math that rules out "OL covering a 4.3 WR via maxed coverage skill" — the ceiling collapses toward negative regardless of skill.

Constants (`0.5`, window shape) are coefficients, tuned by the harness, not theory.

### Tendencies modulate, don't aggregate

Tendencies don't join the aggregate — they apply as **contextual shifts** on the clamped `m`:

- **Composure** — decay `|m|` toward 0 in high-leverage (3rd-down, red-zone, late-Q4) for low-composure players; high-composure holds advantage.
- **Football IQ** — one-sided shifts on decision-gated outcomes: QB IQ lowers INT rate; MLB IQ gates correct run fit.
- **Processing** — reduces effective pressure applied: a fast-processing QB shifts the pass-rush win condition (gets the ball out).
- **Consistency** — narrows variance around the mean percentile, doesn't change the mean. Low-consistency player has both more great and more disastrous games at the same rating.
- **Discipline** — per-player penalty rate shift in `PenaltyModel`.
- **Toughness** — per-contact injury resistance in `InjuryModel`.
- **Motor** — fatigue resistance in `FatigueModel`; late-game effort shift.
- **Clutch** — narrow composure variant for game-on-the-line moments. Keep separate from composure because it correlates with different archetypes.

Each tendency maps to a specific sim lever. If a tendency has no lever, delete it.

### Attribute floor — cross-role attributes live below the pro distribution

`player-attributes.md`'s tier vocab (Replacement=sub-40, Weak=40s, Average=50, Strong=60–75, Elite=85+) describes the **in-role professional distribution**. The 0–100 scale is wider than that.

- `0–20` is the **sub-pro zone**: the action can happen but at a non-professional level. A CB's throw_power is ~5. An OL's route_running is ~2. A high-school-QB CB might reach ~15.
- `20–40` is rare for cross-role — only for archetype-driven outliers (a "utility" player with genuine developed crossover skill).
- `40+` is the professional distribution, intra-position.

This rule needs to land explicitly in `player-attributes.md` as a new principle. Flagged as follow-up (see bottom).

Consequence for the sim: raw skill deltas already deliver most of the "OL can't cover" verdict before physical clamps apply. Clamps reinforce; they don't carry the load alone.

### Archetype as physical-profile outlier

An archetype like "blitz corner" formalizes "this CB's physical score in the `rush` role sits in the pro distribution, not at the cross-role floor." Archetypes don't change the math — they're shorthand for the distributional outliers the math already rewards. Market prices them because they unlock sub-packages that are otherwise unavailable to a roster.

### Measurables (deferred)

Measurables (height, weight, arm length, hand size) modulate role fit, injury risk, fatigue, and contact sub-rolls (tackle-break, jump balls, press, leverage). Player generation will produce size-coherent players — the engine can assume sane sizes and revisit when the generator lands. See [Open questions](#open-questions-and-known-gaps).

---

## Penalties

Runs as two optional sub-rolls per snap. Pre-snap interrupts; post-snap resolves alongside the play.

**Pre-snap** (false start, offsides, delay, illegal formation, 12-men) — sampled before the play call resolves. If hit: yardage penalty, replay down, emit a `PenaltyEvent`, loop back to `PlayCaller`. Rates shift on `discipline` tendency; offensive hard-count plays shift defensive offsides up.

**Post-snap** (holding, DPI, facemask, roughing, illegal block, illegal contact) — sampled alongside resolution. Rates are position- and role-conditioned: weak pass-set LT lifts holding on pass plays; rookie CB lifts DPI when targeted deep.

**Committed-by.** When a penalty fires, draw the committing player from the role pool weighted by individual penalty rates. Gives legible "who got flagged" output and feeds future discipline-development loops.

**Accept/decline** is **deterministic** — compute both resulting states and pick the one with higher expected EPA-style value for the offended team. No RNG. Test exhaustively; this is where sim-correctness bugs hide.

**Offsetting penalties.** Both sides commit on same play → offset, replay the down. Rare but has to work.

**Penalty on scoring plays.** Accept → score negated. Encode as a branch in state transition.

**Bands.** `team-game.json` has per-team-per-game penalty counts/yards (aggregate assertion). `per-position/ot.json` and `iol.json` have position-specific rates. Remaining categories (DPI, roughing, facemask) need a `penalties.json` extracted from PBP via the `nflfastr` skill — **known gap**, tracked in `data/docs/calibration-gaps.md`.

---

## 4th-down decisions

Decision-layer only. Branches at the start of `PlayCaller` when `down == 4`:

```
pGo = situational.fourth_down_go_rate.forZone(zone).forDistance(distBucket).rate
pGo = shiftByAggression(pGo, hc.aggressiveness)
pGo = shiftByDesperation(pGo, state)                    // trailing late → pGo → ~1
choice = rng.choose({go: pGo, not_go: 1 - pGo})
if !go: choice = inFieldGoalRange(zone, K) ? FG_ATTEMPT : PUNT
```

**Calibration target.** `fourth_down_go_rate.by_field_zone_and_distance`. HC `aggressiveness` tendency is the shift variable (aggressive coaches above the band mean, conservative below).

**Desperation override** — trailing by 9+ with <5min Q4 pushes pGo to ~1.0. Band implicit in `pass_rate_by_score_diff_and_time` (trailing 8-14 × under_5_min_q4 = 93% pass). Encode as pre-check before the tendency shift; shift math can't cleanly move 5% → 95%.

**4th-down conversion rate** is **emergent** — it's whatever the resolution layer produces on the run/pass that follows. Calibration: simulated conversion rate should match `fourth_down_conversion_rate.by_field_zone_and_distance`. Mismatch with healthy 3rd-down conversions points to wrong play-type mix on 4th.

---

## Scoring

**Touchdowns — emergent.** A completion or run whose end position crosses the goal line → TD. No separate TD sampler. Yardage bands implicitly encode TD rates; calibration checks team passing/rushing TD totals.

**Field goals — explicit.** `FieldGoalModel`:
- Attempt range gated on K's leg strength and field position.
- Success rate from `special-teams.json` → `field_goals.by_distance` (under_30: 97.7%, 30-39: 93.4%, 40-49: 79%, 50+: 67.7%).
- Matchup shift: K accuracy + composure (long kicks late game). Block rate per bucket, shifted by FG protection unit.
- Blocked FG is a sub-outcome with its own yardage/TD possibilities.

**Extra points.** Auto-attempt after TD unless 2pt fires. Success 94.5%, block 0.71%. Shift on K accuracy.

**2-point conversions.** Decision immediately after TD:

```
pTwo = situational.two_point_attempt_rate.by_score_differential[bucket].rate
pTwo += hc.aggressiveness_shift
if rng.bernoulli(pTwo): run one play from 2-yd line needing ≥2 yds
```

Score-differential bucketing already bakes in 2pt-chart logic (up_1_to_3: 9%, down_15_plus: 31%, tied: 0.7%). Attempt success calibrates against aggregate 47.9% rate.

**Safeties — emergent.** Offense loses yardage past their own 0 → safety. No sampler; state transition only.

---

## Clock

`ClockModel.advance(state, outcome, penalty) → ClockDelta`. Three concerns:

**Per-play runoff** (wall-time the play consumed):
- Incomplete pass: 0 runoff, clock stops.
- Complete pass in bounds: ~6–8s runoff + play duration.
- Run in bounds: ~5–7s + play duration.
- Out of bounds: clock stops (Q1–Q3 until next ready; Q4 under 2min also stops).
- Sack: clock runs (in bounds).
- Penalty: most reset to pre-snap time; some keep running (per rule).
- Kneel: ~40s burn + 1s play.
- Spike: ~3s.
- Score / change of possession: stops.

**Between-play clock** (play clock burn):
- Normal pace: 25–35s, pulled from `tempo` tendency.
- Hurry-up / 2-min: ~15s.
- Clock-kill: ~37s, burn to ~3s on play clock.

**Rules layer:**
- Two-minute warning auto-stops in Q2 and Q4.
- 10-second runoff on offensive penalty under 1 min with clock running.
- Half/quarter expiration kills untimed plays (except defensive penalty extensions).
- Kneel and spike are explicit play calls, not runoff variants.

**Calibration targets** (emergent, not a single band):
- Plays per game (~130 offensive in NFL; UFL/XFL slightly lower — likely the target).
- Time of possession split.
- 2-min drill play count.

**Clock-aware play-calling.** Not a scheme override — a tendency layer. Wrap `PlayCaller` in a `ClockAwareCaller` for end-of-half situations (sideline routes, spikes, timeout triggers). Composed, not inherited.

---

## Overtime

UFL-style rules (charter is a UFL/XFL-style spring league). OT spec:

- **No coin toss.** Home team chooses offense or defense first (or it alternates — confirm against UFL 2024 rulebook when implementing).
- **Alternating possessions from the opponent's 25-yard line.** Each team gets one possession per "round"; game ends when one team leads after both have had equal possessions.
- **No first downs.** Each possession ends in a score or a turnover on downs.
- **Two-point conversion mandatory after each TD** (UFL 2024). No extra-point kicks.
- **Continues until a winner.** Regular season can end tied in the NFL; in UFL every OT game has a winner.

Engine implications:

- OT is its own `GamePhase` — `PlayCaller` conditions tendencies differently (every play is effectively 4th-down-go-for-it; FG decisions are field-position-and-remaining-rounds aware).
- `ClockModel` doesn't matter in OT — no game clock runs between plays, only play clock. Simplifies the model.
- `FourthDownDecider` is forced to always-go inside OT unless in FG range late in the alternation.
- New phase-transition events: `OvertimeStart`, `OvertimePossessionEnd`, `OvertimeWin`.

Calibration for OT is thin (small sample size in real data); don't over-tune. Assert sanity (no infinite OT, winners emerge, TD rate within reason) rather than precision.

---

## Game-flow bookkeeping

Short list of state the engine tracks that isn't in the per-snap pipeline but must be in `GameState`:

- **Coin toss.** Winner chooses receive/kick/defer/side. Emits `CoinToss` event. Consumer can supply the result or engine samples uniformly.
- **Halftime.** At end of Q2: possession flips to whoever didn't receive the Q1 kickoff (or Q1 deferrer). Game clock resets to 15:00. Partial fatigue recovery (tunable coefficient on `FatigueModel`). Timeout counts reset. Emits `Halftime` event.
- **Quarter transitions.** End of Q1 and Q3: possession and down/distance preserve, clock resets to 15:00, field direction flips. Emit `EndOfQuarter`.
- **Timeouts.** 3 per team per half, tracked on `TeamGameState`. Consumed by `ClockAwareCaller` when useful (trailing + need to stop clock + timeouts remaining). `Timeout` event already in the schema; just needs the resource model.
- **Untimed down.** End of half / end of regulation on a defensive penalty extends the period by one untimed snap. Encode as a flag in `GameState`; the next snap runs regardless of `clockAfter`.
- **Two-minute warning.** Auto-stop at 2:00 remaining in Q2 and Q4. Already in the event schema. Resumes on ready-for-play.

None of these are expensive to model — they're bookkeeping. Easy to skip in the walking skeleton and add in step 9 (`ClockModel`) and step 15 (UI wiring) of the build sequence.

---

## Edge-case plays

Each of these is rare but structurally distinct. Listed with where in the engine they live.

- **Hail Mary.** End-of-half desperation pass. `PlayCaller` recognizes "final snap, trailing, 40+ yards from end zone" and emits a Hail Mary play call. `PlayResolver` routes to a dedicated outcome distribution — way lower completion, way higher INT, non-zero jump-ball TD. Bucketed separately from deep passes in PBP. Separate band needed (see [Bands needed](#bands-needed)).
- **Fake punt.** 4th-down decision branch inside `FourthDownDecider`. When decision is PUNT, a small probability (tendency-shifted by HC aggressiveness) flips to `FakePunt` — resolves as a normal run or pass from the punt formation, but with positional talent from the punt team (worse blockers, a punter or RB as the passer/carrier).
- **Fake field goal.** Same pattern as fake punt — a branch inside the FG attempt decision. Resolver runs the play from FG formation with FG-unit personnel.
- **Muffed punt.** Sub-outcome of `Punt` — returner drops, live ball, kicking team can recover. Separate from fair-catch and from fumble-after-return. Needs its own rate. Flag for `PuntModel`.
- **Free kick after safety.** After a safety, the team that was scored upon free-kicks from their own 20. Mechanically a `Punt` or `Kickoff` from a different spot. `KickoffModel` handles it with a flag; no new seam.
- **Defensive two-point conversion.** If defense returns a failed 2pt try to the opposite end zone, they score 2 points. Already handled as a branch inside `TwoPointModel` resolution — `TwoPointAttempt` event needs a `defensiveReturnTd: boolean` field.
- **One-point safety.** Offense fumbles on XP, gets tackled in own end zone → defense gets 1 point. Rare (happened maybe 3 times in NFL history) but cheap to encode. Branch inside `ExtraPointModel` resolution; event schema needs to support a 1-point outcome.
- **Intentional grounding.** Pass-specific penalty triggered when the QB is under pressure, throws to nowhere, and no eligible receiver is near. Falls out of `TargetSelector.Throwaway` + `PenaltyModel` if we model it as a pressure-conditioned penalty probability on throwaways. Penalty type already in the union.

None of these require new seams (except the new band for Hail Marys). All are branches inside existing models.

---

## Pre-game context

Inputs the consumer passes to `SimulateGame` per game. The engine doesn't source them; it consumes them.

```java
public record PreGameContext(
    Weather weather,          // wind speed, precipitation, temperature, visibility
    Stadium stadium,          // surface (turf | grass), roof (open | closed | retractable), altitude
    HomeAway homeAway,        // which team is home; drives crowd-noise effects
    Optional<Long> seed       // game seed; engine generates one if absent
) {}

public record Weather(
    int windMph, WindDirection windDirection,
    Precipitation precipitation,  // NONE | LIGHT_RAIN | HEAVY_RAIN | SNOW
    int temperatureF
) {}
```

**Injuries, roster availability, and coaches are *not* in `PreGameContext`.** Consumers apply roster/injury decisions upstream and pass the dressed roster via the normal game-inputs channel.

### How weather enters the sim

Weather shifts coefficients on specific matchups, never overrides them. Modeled as a small set of scalar modifiers applied at resolver input:

- **Wind** — `FieldGoalModel` accuracy shift (wind parallel to kick direction); punt distance distribution shift; deep-pass accuracy shift.
- **Precipitation** — lifts fumble rate (both carriers and snaps); lifts drop rate on receptions; lifts sack rate (worse footing for OL); reduces completion % on deep passes.
- **Cold** — lifts fumble rate (ball handling); reduces kicker leg strength at range.
- **Altitude** (Denver-style) — lifts deep-pass completion and FG range slightly. Cosmetic but present in real data.

Each modifier is a coefficient tuned against weather-split bands. Mostly small effects — weather is a flavor layer, not a dominant one.

### How stadium/surface enters

- **Turf vs grass** — speed modifier (turf slightly faster), injury rate modifier (turf slightly higher non-contact injury rate). Feeds `InjuryModel` and `FatigueModel`.
- **Roof** — eliminates weather effects when closed/dome. Consumer sets weather accordingly (`indoor` weather pattern) so engine doesn't need to branch on roof state — it just consumes what's passed.

### How home/away enters

- **Road-team false-start rate** shifts up (crowd noise). Applied inside `PenaltyModel` pre-snap for the offense.
- **Road-team audible success** shifts down. Applied as a small penalty to `PlayCaller`'s audible/check mechanism when implemented.
- No generic "home-field advantage" dial — effects are specific and mechanical.

### Weather and the walking skeleton

Walking skeleton assumes indoor / no-weather conditions. Weather integration lands alongside `InjuryModel` / `FatigueModel` (build step 13) since it touches injury and fatigue math. Not on the critical path.

---

## PlayEvent stream and play-by-play narration

The engine's sole output is a stream of `PlayEvent`s. Quick-sim drains to a `BoxScore`; play-by-play renders each event as it comes; persistence writes the stream to the DB; replay re-renders from the persisted stream. One source of truth.

### `PlayEvent` is structured data, not text

The sim emits rich records. Narration is a **separate layer** — a `PlayNarrator` formats events into strings for display. Keeping them separate buys:

- Multiple narration styles from one sim run (terse box-score line vs ESPN-style sentence vs radio-call-verbose).
- Language/localization later without touching the engine.
- Filterable UIs (drive summaries, stat overlays) reading the same data.
- Test-friendly: event assertions don't depend on string formatting.

### Schema — sealed union by outcome

```java
public sealed interface PlayEvent {
    PlayId id();
    GameId gameId();
    int sequence();           // monotonic per game
    DownAndDistance preSnap();
    FieldPosition preSnapSpot();
    GameClock clockBefore();
    GameClock clockAfter();
    Score scoreAfter();

    record PassComplete(
        ..., PlayerId qb, PlayerId target,
        int airYards, int yardsAfterCatch, int totalYards,
        FieldPosition endSpot,
        Optional<PlayerId> tackler,
        List<PlayerId> defendersInCoverage,
        boolean touchdown,
        boolean firstDown
    ) implements PlayEvent {}

    record PassIncomplete(
        ..., PlayerId qb, PlayerId target,
        int airYards, IncompleteReason reason,  // broken_up | overthrown | underthrown | dropped | batted | thrown_away
        Optional<PlayerId> defender
    ) implements PlayEvent {}

    record Sack(..., PlayerId qb, List<PlayerId> sackers, int yardsLost, Optional<FumbleOutcome> fumble) implements PlayEvent {}
    record Scramble(..., PlayerId qb, int yards, FieldPosition endSpot, Optional<PlayerId> tackler, boolean slideOrOob, boolean touchdown) implements PlayEvent {}
    record Interception(..., PlayerId qb, PlayerId intendedTarget, PlayerId interceptor, int returnYards, FieldPosition endSpot, boolean touchdown) implements PlayEvent {}
    record Run(..., PlayerId carrier, RunConcept concept, int yards, FieldPosition endSpot, Optional<PlayerId> tackler, Optional<FumbleOutcome> fumble, boolean touchdown, boolean firstDown) implements PlayEvent {}

    record FieldGoalAttempt(..., PlayerId kicker, int distance, FieldGoalResult result, Optional<PlayerId> blocker) implements PlayEvent {}
    record ExtraPoint(..., PlayerId kicker, PatResult result) implements PlayEvent {}
    record TwoPointAttempt(..., TwoPointPlay play, boolean success) implements PlayEvent {}
    record Punt(..., PlayerId punter, int grossYards, Optional<PlayerId> returner, int returnYards, PuntResult result) implements PlayEvent {}
    record Kickoff(..., PlayerId kicker, KickoffResult result, Optional<PlayerId> returner, int returnYards, boolean onside) implements PlayEvent {}

    record Penalty(..., PenaltyType type, Team against, PlayerId committedBy, int yards, boolean replayDown, Optional<PlayEvent> underlyingPlay) implements PlayEvent {}
    record Kneel(...) implements PlayEvent {}
    record Spike(...) implements PlayEvent {}
    record Timeout(..., Team team) implements PlayEvent {}
    record TwoMinuteWarning(...) implements PlayEvent {}
    record EndOfQuarter(..., int quarter) implements PlayEvent {}
}
```

**Nested sub-events** via `underlyingPlay` (penalty on a pass) or typed options (`FumbleOutcome` inside a Run/Sack). Keeps one `PlayEvent` per snap while letting consumers render composite descriptions ("7-yd pass to Pikachu, fumbled, recovered by Jackson for a 3-yd return").

**Minor corrections** (timeout called, measurement, flag picked up) are their own event types so the narrator can surface them and the timeline is complete.

### Participants are IDs, not names

Events reference `PlayerId` / `TeamId` / coach IDs. Narration looks up names at render time via the roster feature's public use case. Keeps events small, stable, and renameable (player renames, trades mid-season) without rewriting history.

### Sequence and determinism

`sequence` is a monotonic int per game. `(gameId, sequence)` uniquely identifies an event. Same `gameSeed` → same event sequence, byte-for-byte. That's what makes "replay game 42" a `SELECT * FROM play_events WHERE game_id = 42 ORDER BY sequence` plus a narrator pass — no re-simming needed.

### Persistence

Events are the **source of truth** for the game. Box scores, drive charts, season stat lines, historical views — all derived from the event stream (live or via materialized views for speed). Engine writes once; everything else reads.

Schema-wise: one `play_events` table, polymorphic via a `type` column + typed columns or a JSONB payload. Lean toward JSONB for v1 — schema evolution is easier, and we don't query across variant fields much. Migrate to typed tables if query patterns demand it.

### Narrator

```java
interface PlayNarrator {
    String narrate(PlayEvent event, NarrationContext ctx);  // ctx = roster lookup + team identities + style
}
```

Default implementation pattern-matches the sealed `PlayEvent` union in a switch expression, formats per variant. Example for `PassComplete`:

```
"{qb.lastName} → {target.lastName} for {totalYards} yds{firstDown ? ", 1ST DOWN" : ""}{touchdown ? ", TOUCHDOWN" : ""}. Ball at the {endSpot.format()}."
```

Each variant is a short formatter. Swapping style (ESPN / radio / terse) is swapping the `PlayNarrator` implementation. No changes to the engine.

### UI modes share the stream

- **Quick sim.** UI consumes events as a `Stream<PlayEvent>`, folds into a `BoxScore`, shows only the final. Internally the engine does the same work either way — the difference is purely in how the UI drains the stream.
- **Play-by-play.** UI subscribes to events, narrator renders each, optionally animates timing (real-clock pacing or clickthrough).
- **Mid-game switching.** Switching modes mid-game is allowed because both modes draw from the same event source. Either the stream is live and both modes attach to it, or it's being persisted and the UI pages forward/backward through persisted events.

### New seams

| Interface | Responsibility |
|---|---|
| `PlayNarrator` | `PlayEvent + NarrationContext → String`. Style-swappable. |
| `PlayEventStore` | Write/read persisted event streams per game. |
| `BoxScoreAssembler` | Fold `Stream<PlayEvent>` into a `BoxScore`. Pure. |

`PlayNarrator` and `BoxScoreAssembler` are pure functions of the event stream — no sim reruns to recompute.

---

## Stats API

The engine computes stats but **does not persist** them. Stats are pure derivations of the `PlayEvent` stream; persistence, aggregation across games, career totals, and leaderboards are consumer concerns.

### Principles

- **Derived, not stored.** Stats = fold over events. Never mutate in place. A recomputation from events always matches the live value.
- **Uniform records across positions.** A single `PlayerGameStats` record has every stat field (passing, rushing, receiving, defensive, kicking, returns, penalties). Most fields are 0 for most players. Matches how real stat lines work — a QB who scrambled has rushing stats; a WR who threw a trick-play pass has passing stats.
- **Position-specialized views** are lenses over the uniform record, not separate types. A `QbStatLine` view pulls the fields a QB cares about. Keeps the source of truth single.
- **Live + terminal.** Two modes: incremental fold for in-game displays and final aggregation for end-of-game.

### Core records

```java
public record PlayerGameStats(
    PlayerId player, GameId game, TeamId team,

    // passing
    int passAttempts, int passCompletions, int passYards, int passTds, int interceptions,
    int sacksTaken, int sackYardsLost, int longestCompletion,

    // rushing
    int rushAttempts, int rushYards, int rushTds, int longestRush, int fumbles, int fumblesLost,

    // receiving
    int targets, int receptions, int recYards, int recTds, int longestReception, int yardsAfterCatch, int drops,

    // defense
    int tackles, int assists, int tacklesForLoss, int sacks, double qbHits,
    int passesDefensed, int defInterceptions, int intReturnYards, int intTds,
    int forcedFumbles, int fumbleRecoveries, int fumbleReturnYards, int defTds,

    // kicking / punting
    int fgAttempts, int fgMade, int longestFg, int xpAttempts, int xpMade, int blockedKicks,
    int punts, int puntYards, int puntsInside20, int puntTouchbacks,

    // returns
    int kickReturns, int kickReturnYards, int kickReturnTds,
    int puntReturns, int puntReturnYards, int puntReturnTds,

    // misc
    int penalties, int penaltyYards, int snapsPlayed
) {}

public record TeamGameStats(
    TeamId team, GameId game,
    int points, int totalYards, int passingYards, int rushingYards,
    int firstDowns, int thirdDownAttempts, int thirdDownConversions,
    int fourthDownAttempts, int fourthDownConversions,
    int penalties, int penaltyYards,
    int turnovers, int sacksFor, int sacksAgainst,
    TimeOfPossession top, int redZoneAttempts, int redZoneScores,
    int plays
) {}

public record DriveStats(
    DriveId drive, GameId game, TeamId offense, int startSequence, int endSequence,
    FieldPosition startSpot, FieldPosition endSpot,
    int plays, int yards, Duration timeOfPossession,
    DriveResult result  // TD | FG | PUNT | TURNOVER_ON_DOWNS | INT | FUMBLE | SAFETY | END_OF_HALF | FG_MISSED
) {}

public record GameStats(
    GameId game,
    TeamGameStats home, TeamGameStats away,
    Map<PlayerId, PlayerGameStats> players,
    List<DriveStats> drives
) {}
```

### `StatsAssembler` seam

```java
public interface StatsAssembler {
    GameStats finalize(Stream<PlayEvent> events);     // terminal fold
    StatsProjection incremental();                    // live fold, apply(event) returns updated snapshot
}
```

Pure. No side effects. Consumer chooses which mode.

`StatsProjection` is an immutable accumulator:

```java
public interface StatsProjection {
    StatsProjection apply(PlayEvent event);
    GameStats snapshot();
}
```

Every `apply` returns a new instance. Consumers can snapshot at any point — end of drive, end of quarter, whenever the UI demands.

### Attribution — the subtle part

Most stat attribution is direct from the event (`PassComplete` → QB gets an attempt + completion, target gets a reception + yards). Non-obvious cases that need explicit rules:

- **Tackle credits.** `PlayEvent` records `tackler` directly; assists are inferred when multiple defenders are listed on the tackle sub-event. Split-credit rules match NFL convention (full for primary, assist for others).
- **QB hits and hurries.** Pass-rush sub-roll outcomes that don't become sacks still generate hit/hurry events — include them on `Sack` and `PassComplete`/`PassIncomplete` as side data (`qbHits: List<PlayerId>`). Consumers compute hurry rate from that.
- **Forced fumbles and recoveries.** `FumbleOutcome` sub-event carries both `forcedBy` and `recoveredBy`. A forced-and-recovered-by-same-player scores both.
- **Passes defensed.** Derived from `PassIncomplete.reason == BROKEN_UP` with `defender` populated. Not a separate event.
- **Drops.** `PassIncomplete.reason == DROPPED` → drop charged to the target, no completion charged to the QB. Bookkeeping only — doesn't change completion rate (it's already a miss) but is visible to consumers.
- **Snaps played.** Derived from `onField` roster in pre-resolve pipeline — emitted as a `SnapParticipation` side-channel per event (list of on-field player IDs per team). Consumers fold to snap counts.

Attribution logic lives in `StatsAssembler`, not in the event producers. Events are facts; stats are interpretations. Keeping attribution in one place means rule changes (hurry definition, assist split) are one-place edits.

### What the engine does not provide

- **Cross-game aggregates.** Season totals, career totals, splits. Consumer concern — trivial fold over per-game stats, but engine doesn't do it.
- **Persistence.** No DB writes. Consumer writes `GameStats` to wherever — jOOQ tables, document store, event log.
- **Rankings and leaderboards.** Consumer concern. Engine provides the raw numbers.
- **Official NFL stat-correction rules.** We follow the obvious conventions; edge cases (e.g., lateral-to-lateral-to-fumble-recovery-TD scoring) are documented when they come up, not pre-specified.

### UI consumption pattern

```
Stream<PlayEvent> events = simulateGame.run(game);
var projection = statsAssembler.incremental();

events.forEach(event -> {
    projection = projection.apply(event);
    narrator.narrate(event, ctx);         // for play-by-play UI
    ui.update(projection.snapshot());      // for live stat overlays
});

var finalStats = projection.snapshot();    // or statsAssembler.finalize(events) for terminal-only
consumerPersistence.save(finalStats);      // not the engine's problem
```

### New seam

| Interface | Responsibility |
|---|---|
| `StatsAssembler` | `Stream<PlayEvent>` → `GameStats`. Terminal + incremental modes. Pure. |

---

## Determinism and RNG

**Hard contract: every game is fully reproducible from `(gameSeed, inputs)` alone.** No wall-clock RNG, no `ThreadLocalRandom`, no `Math.random`. All stochastic code goes through `RandomSource`.

**Seed flow:**
- Game seed generated at game creation, persisted on the game row.
- `RandomSource` instantiated per game from the seed.
- Split per snap deterministically (e.g., `SplittableRandom.split()` keyed by `(gameId, snapIndex)`) so a mid-game hiccup doesn't bleed RNG state.
- Tests inject `FakeRandomSource` with scripted draws.

**Why non-negotiable:** any bug can be replayed, any user-reported "weird game" is reproducible, coefficient tuning is a real optimization loop rather than guesswork. Zero runtime cost vs unseeded RNG.

**Re-sim with different seed** is a debugging tool (was this outcome representative?), not a user feature — rerunning a game doesn't change the persisted result.

---

## Calibration harness

Separate test module. Not in default CI — slow. Run on coefficient changes and before release.

**Protocol:**
1. Generate N=50 synthetic leagues with league-average players and mid-tier scheme-neutral coaches.
2. Sim a full season per league.
3. Aggregate outputs across N × 10 games × ~130 plays ≈ 65k plays (~1 band slice worth).
4. Assert each band slice falls within tolerance of real value.

**Tolerance:**
- Rates: Wilson score interval at 99% CI.
- Percentiles: bootstrap CI on source band.
- `min` / `max`: asserted over 1M-play runs — never violate.

**Coverage:**
- Every top-level rate (pass rate, sack rate, completion rate).
- `pass_rate_headline_slices` (pre-named: third_and_long_7_plus, leading_14_plus_q4, etc. — band file already identifies the six that matter most).
- `p10, p25, p50, p75, p90` on yardage bands.
- 4th-down go rate by field zone × distance.
- 4th-down conversion rate.
- `two_point_attempt_rate` across score-differential buckets.
- FG success by distance bucket.
- Plays per game, TOP split.
- **Conditional assertions** for tendencies: "QBs below 40 composure have lower late-Q4 passer rating than QBs above 60 composure." These prove soul, not just aggregates.

**Failure → localization:**
- `pass_rate_by_down` off → decision layer (`PlayCaller` tendencies).
- `outcome_mix.sack` off with `pass_rate_overall` correct → resolution (`β_sack`).
- `completion_yards.p90` off with `p50` correct → percentile-shift tail behavior.

**Coefficients** (`β` for logit shifts, `γ` for percentile shifts, `α` for physical-profile constants) stored in `src/main/resources/sim-coefficients.json`, committed, versioned independently from bands. Updates are **manual** — calibration harness reports drift, human commits the new coefficients. Auto-tuning a bad run to pass is worse than failing.

---

## State injection and resume (post-MVP)

Not in MVP scope. Worth calling out because the architecture already supports it — don't accidentally design it out.

Every stage in the per-snap pipeline is pure given `(GameState, RandomSource)`. `GameState` transitions via `apply(outcome, penalty, clock)` return new instances; nothing hidden mutates. The RNG is split per snap from `(gameSeed, snapIndex)`, so its state at any snap is reconstructable from two integers. That means:

- **Serialize and resume.** A consumer can snapshot `GameState` at any inter-snap boundary, persist it, and later hand it back to the engine with the original `gameSeed` + `snapIndex`. The engine re-derives the RNG, picks up at the next snap, and the event stream continues as if nothing happened. Byte-for-byte identical to an uninterrupted run.
- **Hot-swap across processes.** The service could die mid-game; a different instance could resume from the last persisted state. No in-memory state required — `(GameState, gameSeed, nextSnapIndex)` is sufficient.
- **Event-stream replay as an alternative recovery path.** If consumers persist the `PlayEvent` stream (they will — it's the source of truth per [PlayEvent](#playevent-stream-and-play-by-play-narration)), `GameState` can be *reconstructed* by folding events from kickoff rather than snapshotting state. Slower but needs no additional storage.

Requirements for this to stay feasible (keep these true even in MVP):

- `GameState` and its sub-records stay **serializable, self-contained, no back-references** to services or repositories. Pure data.
- `SimulateGame` must have a **resume entry point** shape when the time comes — something like `simulateFrom(GameState, gameSeed, snapIndex) → Stream<PlayEvent>`. MVP only needs `simulate(gameInputs) → Stream<PlayEvent>` but should be structured so the resume variant is a straightforward addition, not a refactor.
- All "state" an active game depends on — fatigue snap counts, injury flags, score, clock, drive context, active rosters — lives inside `GameState`, not in ambient singletons or in-flight caches.

If MVP accidentally violates any of these (e.g., storing per-drive fatigue in a field on `PlayResolver`), resume becomes a rewrite later. Cheap to prevent, expensive to retrofit.

---

## Package layout

```
app.zoneblitz.sim
  ├── SimulateGame              (public use case — interface)
  ├── SimulateGameImpl          (package-private — wait, no *Impl)
  ├── GameSimulator             (package-private — the SimulateGame implementer)
  ├── PlayEvent                 (public sealed — consumed by UI)
  ├── BoxScore                  (public record)
  ├── GameState, DriveState     (package-private records)
  │
  ├── PlayCaller, DefensiveCaller, PersonnelCaller, Substitutions (package-private)
  ├── PlayResolver              (package-private)
  ├── RoleAssigner              (package-private, pure)
  ├── Penalty*, FieldGoal*, ExtraPoint*, TwoPoint*, Punt*, Kickoff* (package-private)
  ├── ClockModel, InjuryModel, FatigueModel (package-private)
  ├── BandSampler, BandRepository (package-private)
  │
  └── *_scripted / *_fake test doubles under src/test/java
```

Cross-feature inputs (roster, coach, player attributes) come through **other features' public use cases**, never their internals. Sim asks `roster.GetActiveRoster` for players, not `roster.PlayerRepository`.

See [`CLAUDE.md`](../../CLAUDE.md) — feature packaging rules apply: flat, package-private by default, no layer subpackages.

---

## Build sequence

Order matters for testability and debuggability. Each step produces a runnable thing calibrated against at least one band.

1. **Walking skeleton.** `GameSimulator` loops snaps with scripted `PlayCaller` and constant-yardage `PlayResolver`. Emits `PlayEvent` stream. Game ends after N plays. No bands yet. Proves the loop + event stream + determinism contract.
2. **`BandSampler` + `RandomSource`.** Load `passing-plays.json`, sample `outcome_mix` and `completion_yards` with no matchup shift. Calibration test: baseline sampling reproduces band within CI.
3. **Resolver — pass plays, no matchup.** Use `BandSampler` for outcome + yardage. No penalties, no clock. Calibration: simulated `outcome_mix` and yardage percentiles match.
4. **Resolver — run plays.** Same shape, `rushing-plays.json`.
5. **Role-based matchup math — pass plays.** Introduce `RoleAssigner`, `PlayResolver` uses `m_pass_rush` and `m_coverage` with logit shifts. Coefficients initialized to 0 — identical output to step 3. Tune until attribute variance produces realistic spread.
6. **Skill + physical + tendency families.** Expand attribute model, wire clamp math and tendency modulators.
7. **Decision layer — `PlayCaller` with tendencies.** Replace scripted caller. Calibrate against `play-call-tendencies.json`.
8. **Personnel + `DefensiveCaller`.** Adds personnel frequency band target.
9. **`ClockModel`.** Calibrate plays-per-game and TOP.
10. **`PenaltyModel`.** Pre-snap + post-snap. Calibrate against `team-game.json` penalty counts.
11. **Special teams.** `FieldGoal`, `ExtraPoint`, `TwoPoint`, `Punt`, `Kickoff` (including onside). Calibrate against `special-teams.json` and `situational.json`.
12. **`FourthDownDecider`.** Integrates with `PlayCaller`.
13. **`InjuryModel` + `FatigueModel`.** Calibrate against `injuries.json` and emergent rotation patterns.
14. **Calibration harness sweeps.** Run N-league batches, assert every band.
15. **UI wiring.** Quick-sim drains `PlayEvent` stream to `BoxScore`; play-by-play renders events. Same stream.

Steps 1–5 are the walking skeleton that validates the architecture before investing in full attribute modeling. If the calibration test at step 3 can't hit the band, nothing after matters.

---

## Bands needed

Consolidated list of bands the engine needs that either don't exist or need extension. Everything reachable via the `nflfastr` or `bigdatabowl` skills. Have the bands materialized into `data/bands/` before starting implementation of the corresponding seam.

### Missing files to create

- **`penalties.json`** — league-wide rates for penalty categories not already sharded by position. Needed: defensive pass interference, defensive holding, roughing the passer, roughing the kicker, facemask, illegal contact, illegal use of hands, unsportsmanlike conduct, personal foul, unnecessary roughness, intentional grounding, offensive/defensive offsides (separately), neutral zone infraction, illegal formation, delay of game, too many men on the field, illegal block in the back, block below the waist. Per-type rate + yardage + conditional slices (on pass plays vs run plays, on deep vs short passes for DPI).
- **`weather-modifiers.json`** — split rates and distributions by weather bucket. Needed: FG success by wind speed bucket, punt distance by wind speed, completion % on deep passes by precipitation, fumble rate by precipitation, drop rate by precipitation, completion % by temperature bucket, FG distance reach by temperature. Real PBP has weather on most games since ~2009.
- **`surface-modifiers.json`** — turf vs grass splits. Needed: non-contact injury rate, soft-tissue injury rate, speed/YPC modifier. Smaller sample than weather but data exists.
- **`home-away.json`** — home vs road splits. Needed: false start rate by offensive team's home/away status, presnap penalty rate by crowd-noise proxy (primetime, playoff, stadium capacity). Mostly small effects; calibrate lightly.
- **`hail-mary.json`** — end-of-half desperation-pass outcome distribution. Needed: completion %, INT %, TD %, yardage given completion. Bucket definition: final snap of a half, pass > 40 yards attempted. Small sample — may need 10+ seasons.
- **`overtime.json`** — OT-specific behavior. Needed: 4th-down go rate in OT (expected near 100%), FG attempt distance distribution in OT, TD rate per OT possession. Very small NFL sample; may need to calibrate against UFL/XFL directly if data available, or extrapolate conservatively.
- **`fake-kicks.json`** — fake punt + fake FG rates and success. Rate of call (per punt and per FG attempt), conversion rate when called. Small sample.
- **`muffed-punts.json`** — muffed punt rate per punt, kicking-team recovery rate on muffs. Derivable from PBP.
- **`checkdown-under-pressure.json`** — needed for `TargetSelector` calibration. Time-to-throw and target-depth distribution split by pressure status. Requires `bigdatabowl` (play-tracking).
- **`sub-play-pass-breakdown.json`** — pressure rate per dropback by offense/defense matchup, completion % on clean vs pressured, separated by depth. Refines `passing-plays.json`'s existing breakdowns. Partially reachable from PBP; deeper cuts need `bigdatabowl`.

### Existing files — extensions or clarifications

- **`passing-plays.json`** — currently breaks down by down/distance. Needed additionally: outcome mix conditional on **pressure status** (clean vs pressured) and on **route depth bucket** (short 0–5 yds, intermediate 6–15, deep 16+). The latter is critical for `TargetSelector` and `CompletionRoll`.
- **`rushing-plays.json`** — same structure as passing-plays. Needed additionally: yardage distribution split by **run concept** (inside zone, outside zone, power, counter, draw) if we go archetype-aware. Nice-to-have, not MVP-blocking.
- **`situational.json`** — already has 4th-down and 2pt. Adding: **onside kick recovery rate by situation** is present but the attempt rates by situation need finer splits for realism around "surprise onside" pre-2018 rules if we care (probably don't — UFL has its own kickoff rules).
- **`special-teams.json`** — extensions: FG success rate conditional on **wind-aligned component** (not just distance); punt net yards conditional on returner quality (may need tracking data).

### Per-position extensions

- **`per-position/*.json`** — existing files cover stat concentration. Needed additionally for sim calibration: penalty rate per position (holding on OL is already there; need equivalents for false start on OL, offsides on DL, DPI per coverage snap on CB/S, roughing per pass rush on EDGE/IDL, unsportsmanlike/personal foul across positions).

### Notes on calibration gaps doc

`data/docs/calibration-gaps.md` should be updated to list all the above. The user can work through them in priority order; MVP-blocking items are penalties.json, sub-play-pass-breakdown.json, and overtime.json (if we're shipping with OT). Weather, surface, home/away, fake kicks, muffed punts, hail mary can land post-MVP without blocking the walking skeleton.

---

## Deliberate exclusions

Things not modeled, with reasons. Don't re-add without a reason the charter supports.

- **Coaching challenges and replay review.** Charter excludes in-game strategy input from the user. NPC-coach challenges are minor realism and their outcomes are noise-on-noise (arbitrary referee judgment applied to already-stochastic plays). Not worth the complexity.
- **Field measurements.** Sim has exact yardage; real-world "measurement for first down" ceremonies don't apply.
- **Official review of scoring / turnovers.** Same reasoning as challenges. The sim emits the outcome; there's no gap between "what happened" and "what the refs ruled."
- **TV timeouts.** Cosmetic. Cadence is a UI concern (play-by-play pacing), not a simulation concern.
- **Injury timeouts (clock stoppage).** The sim emits an `InjuryTimeout` event for narrator use but doesn't model the stoppage as game-impactful — clock behavior during injury stoppage is pass-through.
- **Extra-point-blocked returned for defensive score** — already covered by `ExtraPointModel` + blocked sub-outcome; mentioned here for clarity.
- **Penalties affecting the RNG seed of subsequent plays.** Penalties are events; the RNG splits per snap index, so a penalty-replayed down gets its own deterministic draw. No correlation leak.

### Un-excluding any of these later

Every exclusion above is cheap to reverse. The design is extension-friendly by construction; none of these would require reworking existing code.

- **Narrator/UI-only additions** (TV timeouts, field measurements): zero engine change. Add a new `PlayEvent` variant or a narrator-only hook.
- **Injury timeouts affecting clock**: one branch in `ClockModel` to treat injury events as a stop condition. One-file change.
- **Coaching challenges / replay review / scoring auto-review**: add a new `ReplayReview` stage in the per-snap pipeline after `PlayResolver`. One new interface, one new field on `PlayOutcome` (a `closeCall` flag), one new `PlayEvent` variant. Existing stages untouched. ~a day of work.

Architectural properties that make this cheap:

- **Sealed `PlayEvent` union.** New variants are additive and compile-time-checked — exhaustive `switch` on consumers forces every new variant to be handled somewhere.
- **Per-snap pipeline is a sequence of pure stages.** Inserting a stage between existing ones doesn't refactor upstream stages; they neither know nor care.
- **`GameState` is pure data.** New fields are additive. Serialization / resume survives via defaults.
- **Bands are classpath-loaded JSON.** New bands drop into `data/bands/` and are referenced from the new stage. No schema migration, no deployment coupling.
- **`StatsAssembler` and `PlayNarrator` are independent folds over events.** New event variants or fields hit one place each, not many.
- **Per-snap RNG splitting** (`SplittableRandom.split` keyed by `(gameId, snapIndex)`) isolates any new stage's RNG consumption from later plays. New stages can't leak stochastic state.

One thing that *would* be genuinely expensive — and is not on the exclusion list — is **retroactively changing to sub-play granularity** (per-OL-vs-per-DL, per-receiver-on-route-concept resolution). That touches the resolver's core math. If we ever want to go there, do it as a parallel second implementation behind the `PlayResolver` interface, swapped in via configuration, rather than evolving the current resolver in place. The seam design already accommodates that approach without disrupting the rest of the engine.

---

## Open questions and known gaps

- **`penalties.json` band file** — doesn't exist. Needs extraction from PBP for non-position-specific categories (DPI, roughing, facemask). Use `nflfastr` skill; land at cache-build time.
- **Coefficients initial values** — no prior, start at 0 (identity). Calibration harness is the tuning loop. Expect 2–3 iterations per band family before convergence.
- **Measurables integration** — deferred until player generator produces sane sizes. When they land, add size-window role fit (multiplicative into `physicalScore`), mass-driven injury/fatigue inputs, and contact sub-rolls (tackle-break, jump balls, press, leverage).
- **Sub-play granularity** — current model is two sub-rolls per pass/run play. If scheme-fit narrative feels flat in sim output, revisit per-receiver / per-DL granularity. Not expected.
- **Situational playbooks vs. tendency shifts** — current model derives situational play calls from `situational.json` × tendency. If coach-archetype distinctiveness feels low, consider per-scheme explicit playbooks with conditional distributions instead.
- **Fatigue model specifics** — needs a concrete math spec: per-snap decay curve, stamina resistance, mass modifier (once measurables land), recovery between drives.
- **Two-minute drill autonomy** — `ClockAwareCaller` wraps `PlayCaller` for end-of-half. Concrete strategy for "needed score given clock + timeouts" TBD; can start naive (always pass sideline) and iterate.

---

## Follow-ups to other docs

- **[`player-attributes.md`](../product/north-star/player-attributes.md)** — add explicit principle: *Out-of-role attributes live below the professional floor (0–20). The 0–100 scale spans sub-pro to elite-pro; the tier vocab (Replacement/Weak/Average/Strong/Elite) describes only 40–100, which is the in-role professional distribution.*
- **[`data/docs/calibration-gaps.md`](../../data/docs/calibration-gaps.md)** — note the missing `penalties.json`, the need for role-based penalty rates, and the per-position sub-roll bands (pressure rate, tackle-break rate) that may need extraction via `bigdatabowl`.
