# F1 — walking skeleton

**Deps:** none. **Bands:** none. **Unblocks:** everything.

## Goal

Prove the per-snap loop + deterministic event emission + the full `PlayEvent` / `GameState` shell. Zero bands, zero matchup math. A game is N scripted snaps emitting N events; same seed → same stream byte-for-byte.

This task's main job is **pre-carving the shared surface** so later tasks don't collide.

## Doc context (read only these ranges)

- `sim-engine.md` lines 20-52 (per-snap pipeline)
- lines 488-533 (PlayEvent schema — copy the full sealed union, empty bodies for variants you don't resolve yet)
- lines 725-736 (determinism + RNG contract)
- lines 795-818 (package layout)

## Owns (create these files)

- `src/main/java/app/zoneblitz/sim/SimulateGame.java` — public use-case interface: `Stream<PlayEvent> simulate(GameInputs inputs)`.
- `src/main/java/app/zoneblitz/sim/GameSimulator.java` — package-private impl. Loops snaps via scripted caller + constant-yardage resolver.
- `src/main/java/app/zoneblitz/sim/GameInputs.java` — record: rosters, coaches, `PreGameContext`, optional seed.
- `src/main/java/app/zoneblitz/sim/GameState.java` — **full field set** (score, clock, down, distance, spot, possession, drive, fatigue snap counts, injury flags, timeouts, phase, OT round). Values are zeros/defaults/empty collections. Pure data, serializable, no back-refs.
- `src/main/java/app/zoneblitz/sim/PlayEvent.java` — **full sealed permits list** from doc 488-533. Variant bodies empty (fields present but most default to 0/empty). Later tasks fill in logic, never touch the `sealed interface` line.
- `src/main/java/app/zoneblitz/sim/PlayCaller.java` — interface only.
- `src/main/java/app/zoneblitz/sim/PlayResolver.java` — interface only.
- `src/main/java/app/zoneblitz/sim/ScriptedPlayCaller.java` — test-scoped, in `src/test/java`. Returns a pre-canned call sequence.
- `src/main/java/app/zoneblitz/sim/ConstantPlayResolver.java` — test-scoped. Returns the same `Run(5 yards)` every time.
- `src/main/java/app/zoneblitz/sim/RandomSource.java` — interface: `long nextLong()`, `double nextDouble()`, `RandomSource split(long key)`.
- `src/main/java/app/zoneblitz/sim/SplittableRandomSource.java` — prod impl over `SplittableRandom`. Per-snap split keyed by `(gameId, snapIndex)`.
- `src/test/java/app/zoneblitz/sim/FakeRandomSource.java` — scripted draws for tests.
- `src/main/java/app/zoneblitz/sim/SimConfiguration.java` — Spring `@Configuration` wiring. Marker class; may be empty beyond the `SimulateGame` bean.

## Forbidden

- Any band sampling. No reads under `data/bands/`.
- Any matchup math, role assignment, personnel/defensive callers.
- Any model under the "Models" cluster (clock, penalty, injury, fatigue).
- Any special-teams model.
- Persistence — no `PlayEventStore`, no Flyway migration.
- Narrator, stats assembler.

## Tests

1. `GameSimulatorTests.simulate_withScriptedCaller_emitsOneEventPerSnap` — N snaps → N events, monotonic `sequence`.
2. `GameSimulatorTests.simulate_sameSeed_producesByteIdenticalStream` — run twice with same `gameSeed`, assert event lists equal.
3. `GameSimulatorTests.simulate_differentSeed_producesDifferentStream` — sanity: seeds actually matter (even with constant resolver, splits differ somewhere observable — introduce a single RNG consumption point to make this true).
4. `GameStateTests` — `apply(outcome, penalty, clock)` returns new instance, original unchanged.
5. `PlayEventTests.sealedUnion_exhaustiveSwitch_compiles` — write a switch over all variants; ensures permits list is complete.

## Definition of done

- 5 tests above pass.
- `./gradlew spotlessApply && ./gradlew spotlessCheck test` green.
- `git diff --stat` touches only files listed in **Owns**.
- PR description: "Foundation — do not merge other sim PRs until this lands."
