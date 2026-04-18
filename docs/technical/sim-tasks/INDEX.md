# Sim engine — task breakdown

Agent-friendly decomposition of [`sim-engine.md`](../sim-engine.md). Pick one task, read only its brief + the doc line ranges it cites, implement. Do not read the full design doc unless a task brief tells you to.

## Conventions

- **Worktree per task.** Run each task in its own git worktree to keep merges clean.
- **Package:** `app.zoneblitz.sim`. Flat, package-private by default. See `CLAUDE.md`.
- **ITDD.** Interface + Javadoc contract + tests before impl.
- **File ownership is explicit.** Each brief lists `Owns:` and `Forbidden:`. If you need to edit a forbidden file, stop and escalate — don't expand scope silently.
- **Done =** tests pass, calibration assertion hits, `./gradlew spotlessApply && ./gradlew spotlessCheck test` green, `git diff --stat` touches only owned files.

## Pre-carved hotspots (avoid merge hell)

1. **`PlayEvent` sealed union** — F1 lands the full `permits` list with empty-bodied records. Later tasks fill bodies; never edit the sealed interface declaration.
2. **`GameState` record** — F1 lands every field the full engine needs with zero/default values. Later tasks read fields; adding a field requires a scoped refactor task.
3. **`sim-coefficients.json`** — partitioned by top-level key. Each task writes only under its declared key prefix.
4. **Wiring `@Configuration`** — each area (resolver, decision, models, special-teams, output) has its own `@Configuration`.
5. **`data/bands/*.json`** — B-series tasks are the only writers. Code tasks only read.

## Dependency graph

```
F1 ─┬─► F2 ─► R1 ─► R2 ─► R3 ─► R4 ─► R5 ─► D1 ─► D2 ─► D3 ─┬─► M1 ─┐
    │                                                         ├─► M2  │
    │                                                         ├─► M3 ─┤
    │                                                         └─► M4 ─┤
    │                                                                  ├─► C1
    ├─► ST1..ST5  (parallel after F2)  ──────────────────────────────►┤
    ├─► O1, O2, O3  (parallel after F1) ──────────────────────────────┘
    │
B1..B11 band extraction — parallel to all code work; only touches data/bands/
```

## Foundation (serial, one author)

- **[F1](F1-walking-skeleton.md): walking skeleton.** Deps: none.
- **[F2](F2-band-sampler.md): band sampler + RandomSource.** Deps: F1.

## Resolvers (serial)

**R1: pass resolver baseline (no matchup).** Deps: F2. Bands: `passing-plays.json`.
- Owns: `PlayResolver.java`, `BaselinePassResolver.java`, `PlayOutcome.java`, tests.
- Forbidden: matchup math, run plays, target selection.
- Doc: lines 20-52.
- DoD: 10k-snap calibration reproduces `outcome_mix` + yardage percentiles within 99% Wilson CI.

**R2: run resolver baseline.** Deps: R1. Bands: `rushing-plays.json`.
- Owns: `BaselineRunResolver.java`, tests.
- DoD: same calibration shape, rushing bands.

**R3: role-based pass matchup.** Deps: R2. Coefficients under `resolver.pass.matchup`.
- Owns: `RoleAssigner.java`, `Roles.java`, matchup-aware `MatchupPassResolver.java`.
- Forbidden: per-receiver math (keep `m_coverage` aggregate).
- Doc: lines 121-143.
- DoD: β=0 reproduces R1 byte-for-byte; β>0 shows expected spread on hand-built roster scenarios.

**R4: attribute families + physical clamp + tendencies.** Deps: R3.
- Owns: `Physical.java`, `Skill.java`, `Tendencies.java`, clamp math in resolver.
- Doc: lines 203-268.
- DoD: OL-at-max-coverage-skill still loses to average WR (clamp scenario test).

**R5: target selector + per-receiver pass detail.** Deps: R4. Bands: `passing-plays.json`, `position-concentration.json`.
- Owns: `TargetSelector.java`, `TargetChoice.java` sealed union, per-receiver branch in resolver.
- Doc: lines 144-200.
- DoD: WR1/TE1 target shares reproduce `position-concentration.json` without tuning.

## Decision layer (serial)

**D1: play caller.** Deps: R5. Bands: `play-call-tendencies.json`, `situational.json`, `red-zone-and-third-down.json`.
- Owns: `PlayCaller.java`, `PlayCall.java`, `TendencyPlayCaller.java`.
- DoD: pass-rate-by-down reproduces band.

**D2: personnel + defensive caller + substitutions.** Deps: D1. Bands: `play-call-tendencies.json` (personnel freq).
- Owns: `PersonnelCaller.java`, `DefensiveCaller.java`, `Substitutions.java`.

**D3: fourth-down decider.** Deps: D1. Bands: `situational.json:fourth_down_go_rate`.
- Owns: `FourthDownDecider.java`, integration point in `PlayCaller` at `down==4`.
- Doc: lines 292-308.

## Models (parallel cluster after D3)

- **M1 ClockModel** — doc 337-369. DoD: plays-per-game ~130.
- **M2 PenaltyModel** — deps B1. Doc 272-289.
- **M3 Injury + Fatigue** — bands `injuries.json`, `ir-usage.json`. Doc 917.
- **M4 Environmental modifiers** (weather/surface/home-away) — deps B2/B3/B4. Doc 426-470.

## Special teams (parallel cluster after F2)

Each owns its interface + impl + tests + fills in its `PlayEvent` variant body (variants already declared by F1).

- **ST1 FieldGoalModel** — `special-teams.json:field_goals`. Doc 315-320.
- **ST2 ExtraPointModel** — `special-teams.json`. Doc 322.
- **ST3 TwoPointModel** — `situational.json:two_point_*`. Doc 323-333.
- **ST4 PuntModel** — `special-teams.json`, deps B8 for muffs.
- **ST5 KickoffModel** — `special-teams.json`, includes onside.

## Output layer (parallel after F1)

- **O1 PlayNarrator** — `PlayNarrator.java`, `DefaultPlayNarrator.java`, `NarrationContext.java`. Pure over `PlayEvent`. Doc 474-584.
- **O2 StatsAssembler** — `StatsAssembler.java`, `StatsProjection.java`, `PlayerGameStats.java`, `TeamGameStats.java`, `DriveStats.java`, `GameStats.java`, `BoxScoreAssembler.java`. Doc 588-721.
- **[O3](O3-play-event-store.md) PlayEventStore** — interface + `JooqPlayEventStore.java` + Flyway `V***__create_play_events.sql` (JSONB payload). Doc 548-552.

## Band extraction (parallel — data only)

All: sole authors of `data/bands/<name>.json`; update `data/docs/calibration-gaps.md`. Use `nflfastr` or `bigdatabowl` skills. No Java.

- **B1** `penalties.json` (nflfastr) — **MVP blocker**
- **B2** `weather-modifiers.json` (nflfastr)
- **B3** `surface-modifiers.json` (nflfastr)
- **B4** `home-away.json` (nflfastr)
- **B5** `hail-mary.json` (nflfastr, ≥10 seasons)
- **B6** `overtime.json` — may need UFL/XFL; extrapolate conservatively
- **B7** `fake-kicks.json` (nflfastr)
- **B8** `muffed-punts.json` (nflfastr) — blocker if ST4 ships
- **B9** `checkdown-under-pressure.json` (bigdatabowl)
- **B10** `sub-play-pass-breakdown.json` (bigdatabowl) — **MVP blocker**
- **B11** per-position penalty rates — extend `per-position/*.json`

## Calibration (final)

- **C1 calibration harness** — separate test module, out of default CI. Doc 740-772.

## Stub → full brief promotion

Stubs above are enough to start. When picking up a stub, either:
1. Implement directly if the stub is sufficient, or
2. Promote to a full `<id>-<slug>.md` brief before coding (use F1/F2 as templates).

## Picking up a task

1. Read this INDEX, the task brief (or stub), the doc line ranges cited. Nothing else from `sim-engine.md`.
2. Check upstream deps are merged to `main`.
3. `git worktree add ../zone-blitz-<task-id> -b sim/<task-id>` and work there.
4. Run spotless + tests before declaring done. Verify `git diff --stat` hits only owned paths.
