# R4 — attribute families + physical clamp + tendencies

**Deps:** R3. **Unblocks:** R5, calibration harness tuning.

## Goal

Land the three attribute families on `Player` and install the physical-fit clamp as the production `PassMatchupShift` on `MatchupPassResolver`. Ships with average-everywhere defaults so existing rosters continue to produce `shift = 0`; non-trivial rosters exercise the clamp.

## Doc context

- `sim-engine.md` lines 203-268 (attribute families, physical clamp, tendencies, cross-role floor).

## Owns

- `src/gamesimulator/java/app/zoneblitz/gamesimulator/roster/Physical.java` — record: `speed, acceleration, agility, strength, power, bend, stamina, explosiveness` (0–100 each).
- `src/gamesimulator/java/app/zoneblitz/gamesimulator/roster/Skill.java` — record: pass-matchup technique axes (`passSet, routeRunning, coverageTechnique, passRushMoves, blockShedding, hands`), 0–100.
- `src/gamesimulator/java/app/zoneblitz/gamesimulator/roster/Tendencies.java` — record: `composure, discipline, footballIq, processing, toughness, clutch, consistency, motor` (0–100).
- `src/gamesimulator/java/app/zoneblitz/gamesimulator/roster/Player.java` (edit) — carry the three families; keep the legacy three-arg constructor delegating to `Physical.average()` / `Skill.average()` / `Tendencies.average()`.
- `src/gamesimulator/java/app/zoneblitz/gamesimulator/resolver/ClampedPassMatchupShift.java` — implements the clamp formula; nested `PhysicalRole` / `SkillAxis` enums describe the per-role weight vectors.
- `src/gamesimulator/java/app/zoneblitz/gamesimulator/resolver/MatchupPassResolver.java` (edit) — swap `load()` default from `PassMatchupShift.ZERO` to `new ClampedPassMatchupShift()`.
- Tests:
  - `ClampedPassMatchupShiftTests` — scenario coverage including the OL-at-max-coverage-skill case.

## Forbidden

- Per-receiver matchups / target selection (R5).
- Active tendency levers outside the clamp surface (discipline → `PenaltyModel`, toughness → `InjuryModel`, etc. land with their respective tasks). R4 declares the fields; downstream tasks wire behavior.
- Editing the sealed `PlayEvent` union or `PlayOutcome` variants.
- New band files.

## Key design notes

- **Compact Player API survives.** Existing tests and code paths that build `Player(id, position, name)` keep working — the three-arg constructor fills in `average()` families. No call sites updated.
- **Clamp formula per doc.** With `gap = off_physical_score − def_physical_score`:
  - `floor   = −1 + 0.5 × max(0, gap)`
  - `ceiling = +1 + 0.5 × min(0, gap)`
  - `m = clamp(off_skill_aggregate − def_skill_aggregate, floor, ceiling)`
- **Scalar composition.** The coverage and pass-rush clamped deltas compose into a single scalar via `coverage − passRush` — positive when offense (completion pressure) wins on both fronts, negative when defense (pass rush / coverage) wins. This is the same single-scalar surface R3 established; per-matchup-input β vectors are still deferred.
- **Tendency fields present, levers deferred.** Each tendency has a named destination (`composure → in-context decay`, `discipline → PenaltyModel`, …). R4 carries the data so downstream tasks can read it without schema churn.
- **Average == identity.** All three `average()` factories return midpoint values. When every player on both sides is average, every aggregate is zero, every gap is zero, and the clamp returns zero — which is why the R3 byte-for-byte parity test stays green.

## Tests

1. `compute_averageRosters_returnsZero` — identity sanity.
2. `compute_offenseSkillAdvantage_withMatchingPhysicals_returnsPositive` — raw skill delta passes through when the physical window is `[-1, +1]`.
3. `compute_defenseSkillAdvantage_inUnfavorablePhysicalMatchup_isClampedByFloor` — OL-at-max-coverage-skill scenario: WR (elite physicals, avg skill) vs OL (poor physicals, max coverage skill) produces a shift strictly greater than the unclamped raw skill delta (i.e., the floor bit).
4. `compute_offenseSkillAdvantage_inUnfavorablePhysicalMatchup_isClampedByCeiling` — symmetric case: maxed-skill defender can't push below the raised floor; maxed-skill offense can't push above a collapsed ceiling.

## Definition of done

- Tests pass.
- R3 byte-for-byte parity test remains green (asserts the `average()`-default wiring still produces shift=0).
- `./gradlew spotlessApply && ./gradlew spotlessCheck test` green.
- `git diff --stat` restricted to **Owns** plus this brief.
