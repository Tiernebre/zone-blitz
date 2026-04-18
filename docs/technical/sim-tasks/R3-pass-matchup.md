# R3 — role-based pass matchup

**Deps:** R2. **Unblocks:** R4.

## Goal

Wrap the baseline pass resolver in role assignment + a single `matchupShift` scalar that feeds the rate band's per-outcome β coefficients inside `BandSampler.sampleRate`. With the shipped `passing-plays.json` (all β = 0) the matchup-aware resolver reproduces `BaselinePassResolver` byte-for-byte; with a synthetic β > 0 band + a non-zero shift the outcome mix moves in the expected direction.

Per-receiver matchups and target selection are **out of scope** — they land in R5. R3 keeps `m_coverage` as a single aggregate.

## Doc context

- `sim-engine.md` lines 121-143 (role-based matchup math, single-aggregate coverage).
- `sim-engine.md` lines 86-99 (log-odds rate-band shift).

## Owns

- `src/gamesimulator/java/app/zoneblitz/gamesimulator/resolver/Roles.java` — record holding the four pass-play role buckets (pass rushers, pass blockers, route runners, coverage defenders).
- `src/gamesimulator/java/app/zoneblitz/gamesimulator/resolver/RoleAssigner.java` — interface.
- `src/gamesimulator/java/app/zoneblitz/gamesimulator/resolver/PositionBasedRoleAssigner.java` — default impl: buckets by `Position` for pass plays.
- `src/gamesimulator/java/app/zoneblitz/gamesimulator/resolver/MatchupPassResolver.java` — matchup-aware resolver. Carries a nested `PassMatchupShift` functional interface with a `ZERO` identity default.
- Tests:
  - `RoleAssignerTests` — bucketing by position, ignores specialists.
  - `MatchupPassResolverCalibrationTests` — β=0 byte-for-byte vs `BaselinePassResolver`; β>0 synthetic band shifts outcome mix in the expected direction.

## Forbidden

- Per-receiver matchup math or target selection (that's R5).
- Attribute-family reads from `Player` (that's R4 — `Physical`/`Skill`/`Tendencies` don't exist yet).
- Writing under `resolver.pass.matchup` in `sim-coefficients.json` — the coefficients currently live on the rate band itself; a dedicated coefficients file arrives with R4.
- Editing the sealed `PlayEvent` union.

## Key design notes

- **Single scalar shift.** `BandSampler.sampleRate` takes one `matchupShift` double; the rate band carries per-outcome β coefficients. R3 condenses pass-rush and coverage wins into that one scalar via the injected `PassMatchupShift`. Per-matchup-input β vectors are deferred — when R4 lands attribute aggregates the scalar composition formula can evolve.
- **Zero default.** `PassMatchupShift.ZERO` always returns 0.0. Combined with the shipped band's default β = 0, this gives an identity resolver — every RNG draw, every outcome, every yardage value matches `BaselinePassResolver` bit-for-bit.
- **Role assignment is pure.** `RoleAssigner` sees the play call + both teams, returns buckets. No RNG, no state mutation. R3's `PositionBasedRoleAssigner` ignores the call kind and uses position; later assigners will honor personnel, blitz packages, and max-protect.

## Tests

1. `RoleAssignerTests.assign_mixedRoster_bucketsByPosition` — WR/TE/RB → route runners; OL/FB → pass blockers; DL/LB → rushers; CB/S → coverage; K/P/LS/QB dropped from buckets.
2. `MatchupPassResolverCalibrationTests.resolve_zeroShift_matchesBaselineResolverByteForByte` — 1k snaps on identical seeds, identical rosters, identical state → `assertThat(matchupOutcomes).isEqualTo(baselineOutcomes)`.
3. `MatchupPassResolverCalibrationTests.resolve_positiveShiftOnComplete_raisesCompletionRate` — synthetic rate band with `β(COMPLETE) = +2.0`, `PassMatchupShift` that returns +1.0, observed completion rate > baseline completion rate over 10k snaps (delta well outside Wilson 99% CI).

## Definition of done

- All three tests above pass.
- `./gradlew spotlessApply && ./gradlew spotlessCheck test` green.
- `git diff --stat` restricted to **Owns** plus this brief.
