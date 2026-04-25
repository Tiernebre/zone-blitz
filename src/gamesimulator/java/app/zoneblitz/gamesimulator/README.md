# Game Simulator

Play-level football simulation engine. A per-snap pipeline over seeded RNG, calibrated against real-NFL distributions (`data/bands/`), emitting a deterministic `PlayEvent` stream. Lives in its own Gradle source set (`src/gamesimulator/`) bundled into the same boot JAR so web-layer code cannot leak into it. Reproducibility contract: for the same `GameInputs` (including seed), the emitted stream is byte-identical across processes.

## Dependency direction

- This source set imports **zero** types from `app.zoneblitz.league` or any other application package.
- `league` may depend on `gamesimulator` (via `SimulateGame`, `RandomSource`, etc.).
- No Spring / Jakarta imports inside `src/gamesimulator/java/`. The sole Spring wiring for the sim lives at [`src/main/java/app/zoneblitz/gamesimulator/SimConfiguration.java`](../../../../../main/java/app/zoneblitz/gamesimulator/SimConfiguration.java).

The dependency is enforced by source-set layout; treat any `league` import in this source set as a bug.

## Public API

- `SimulateGame` — top-level use case. Simulate one game from a `GameInputs` and stream `PlayEvent`s.
- `GameInputs`, `GameSummary`, `GameState`, `GameType` — the request/response shapes and game state.
- `environment.HomeFieldAdvantage`, `environment.Weather`, `environment.Surface`, `environment.Roof`, `environment.EnvironmentalModifiers` — environmental inputs.
- `PlayEvent` + event-package records (`DownAndDistance`, `PassConcept`, `RunConcept`, `PlayId`, `PlayerId`, `TeamId`, `GameClock`, `Score`, `PenaltyType`, `InjurySeverity`, `PatResult`, `TwoPointPlay`, `KickoffResult`, `PuntResult`, `FieldGoalResult`, `FumbleOutcome`, `IncompleteReason`, `Side`, `GameId`) — the output event vocabulary.

## Seam interfaces

Every stochastic seam takes `RandomSource` as a method parameter (not a field) so games replay byte-for-byte from a seed. No seam depends on Spring.

- `RandomSource` (package `rng`) — the only source of randomness. `split(long key)` for per-stage child streams. `SplittableRandomSource` is the production implementation; only it may touch `java.util.SplittableRandom` directly (enforced by ArchUnit).
- `playcalling.PlayCaller` — offensive play-call selection given `GameState`, `Coach`, `RandomSource`.
- `clockmgmt.TimeoutDecider`, `clockmgmt.EndOfHalfDecider` — clock-management heuristics; tendency-driven defaults ship.
- `fourthdown.FourthDownPolicy` — 4th-down go/kick/punt decision; `AggressionFourthDownPolicy` ships as the tendency-driven default.
- `fatigue.FatigueModel` — rotation hook + per-snap performance multiplier; `PositionalFatigueModel` is the default.
- `environment.HomeFieldModel` — snap-level home-field tilt from environmental modifiers.
- `resolver.PlayResolver` — top-level dispatcher.
- `resolver.pass.PassResolver`, `resolver.pass.TargetSelector`, `resolver.PassRoleAssigner` — pass family.
- `resolver.run.RunResolver`, `resolver.RunRoleAssigner` — run family.
- `resolver.FumbleRecoveryModel` — recovery side resolution.
- `clock.ClockModel` — per-play clock advance (default `BandClockModel`).
- `penalty.PenaltyModel` — pre-snap and play penalty sampling (default `BandPenaltyModel`).
- `injury.InjuryModel` — injury draw (default `BaselineInjuryModel`).
- `formation.BoxCountSampler`, `formation.CoverageShellSampler` — pre-snap defensive formation samplers (band-backed defaults).
- `playcalling.DefensiveCallSelector` — defensive call selection.
- `personnel.PersonnelSelector` — who is on the field for a snap.
- `kickoff.KickoffResolver`, `punt.PuntResolver` — special-teams resolvers.
- `scoring.FieldGoalResolver`, `scoring.ExtraPointResolver`, `scoring.TwoPointResolver`, `scoring.TwoPointDecisionPolicy` — scoring family.
- `band.BandRepository`, `band.BandSampler` — band file loading and sampling (`ClasspathBandRepository` + `DefaultBandSampler`).
- `output.PlayNarrator` — event-to-text narration (`DefaultPlayNarrator`).

## Internal structure

Sub-packages by concern: `band/`, `clock/`, `clockmgmt/`, `environment/`, `event/`, `fatigue/`, `formation/`, `fourthdown/`, `injury/`, `kickoff/`, `output/`, `penalty/`, `personnel/`, `playcalling/`, `punt/`, `resolver/` (with `pass/` and `run/`), `rng/`, `roster/`, `scoring/`. Top-level engine classes (`GameSimulator`, `ScoringSequencer`, `ScoringAftermath`, `SnapAdvance`, `PeriodController`, `SpecialTeams`, `PlayEventFactory`, `EndOfHalfPlays`, `TimeoutController`, `DownProgression`, `InjuryEmitter`, `PenaltyEmitter`) coordinate the pipeline.

## Extending

- Adding a new seam or implementation: see [`docs/playbooks/add-a-sim-seam.md`](../../../../../../docs/playbooks/add-a-sim-seam.md). Interface + implementation named by distinguishing trait (no `*Impl`) + calibration test against a named band under `data/bands/`.
- No `Math.random`, `new Random()`, or `ThreadLocalRandom` anywhere — enforced by ArchUnit. Only `SplittableRandomSource` may touch `java.util.SplittableRandom`.
- Spring `@Bean`s for seams go in [`SimConfiguration`](../../../../../main/java/app/zoneblitz/gamesimulator/SimConfiguration.java) (which lives in `src/main/java`); pure sim-internal wiring is direct constructor injection in `GameSimulator`.

## Tests

Tests at `src/test/java/app/zoneblitz/gamesimulator/` mirror the source package layout.

- Calibration tests run 10k trials with a hardcoded per-test seed and assert tolerance intervals (not point values) against percentiles / rates from `data/bands/`. See `CalibrationAssertions` helpers.
- `DriveOutcomeCalibrationTests` and `FullGameCalibrationTests` log delta-from-target without failing the build; seam-level calibration tests do the failing.
- `ConstantPlayResolver` is the canonical scripted fake for deterministic resolver swap-outs.
- `@Execution(ExecutionMode.CONCURRENT)` is safe because every per-test RNG is seeded.

## Design docs

- [`docs/technical/sim-engine.md`](../../../../../../docs/technical/sim-engine.md) — per-snap pipeline, matchup math, band sampling, `PlayEvent` stream, calibration harness.
- [`CLAUDE.md`](../../../../../../CLAUDE.md) — project-wide conventions.
