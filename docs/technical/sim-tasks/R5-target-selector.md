# R5 — target selector + per-receiver pass detail

**Deps:** R4. **Unblocks:** D1.

## Goal

Land the `TargetSelector` seam between pass-rush resolution and the completion/YAC roll, and wire it
into `MatchupPassResolver`. The selector picks the intended receiver (or a non-throw branch) from
the `Roles.routeRunners()` list using the per-receiver matchup formula from `sim-engine.md` lines
144–200; the resolver consumes the pick for throw-shaped outcomes. WR1 and TE1 target shares
emerge from the selector's scoring + Gaussian noise interaction — they match the shape of
`position-concentration.json` without a direct target-share dial.

Per-receiver completion/catch/YAC rolls conditioned on the selected receiver's matchup are still
out of scope — R5 surfaces the selector, but the existing outcome-mix rate band still drives
COMPLETE / INCOMPLETE / SACK / SCRAMBLE / INTERCEPTION shape. Pressure-driven sack and scramble
branches land with the pass-rush sub-roll.

## Doc context

- `sim-engine.md` lines 144–200 (pass-play resolution detail, `TargetSelector` math, `TargetChoice`
  sealed union).

## Owns

- `src/gamesimulator/java/app/zoneblitz/gamesimulator/resolver/TargetChoice.java` — sealed union
  `Throw(receiverId, depth) | Scramble | Throwaway | Sack`.
- `src/gamesimulator/java/app/zoneblitz/gamesimulator/resolver/TargetSelector.java` — interface;
  consumes `(PlayCall, Roles, Player qb, RandomSource rng)` and returns a `TargetChoice`.
- `src/gamesimulator/java/app/zoneblitz/gamesimulator/resolver/ScoreBasedTargetSelector.java` —
  default impl. Per-receiver `m_route` + depth value + position-tier bias + QB Gaussian
  processing noise → argmax receiver.
- `src/gamesimulator/java/app/zoneblitz/gamesimulator/resolver/MatchupPassResolver.java` (edit) —
  carry a `TargetSelector` field, route the selector's pick into `PassComplete` / `PassIncomplete`
  / `Interception` targets.
- `src/gamesimulator/java/app/zoneblitz/gamesimulator/rng/RandomSource.java` (edit) + impls — add
  `nextGaussian()` to the RNG contract (Gaussian noise is the selector's one RNG consumer). This is
  an allowed scope expansion — every downstream model that needs Gaussian noise (accuracy jitter,
  fatigue drift, weather variance) consumes it through the same seam.
- Tests:
  - `MatchupPassResolverCalibrationTests.resolve_zeroShiftWithFirstRouteRunnerSelector_matchesBaselineResolverByteForByte`
    — replaces the R3 parity test. The structural parity (matchup resolver + deterministic
    selector reproducing `BaselinePassResolver` byte-for-byte) holds; the default wiring now
    consumes one Gaussian per candidate receiver, which shifts the RNG stream. A test fake
    (`FirstRouteRunnerTargetSelector`) provides the non-consuming selector for the parity run.
  - `MatchupPassResolverCalibrationTests.resolve_equalAttributeRoster_wr1AndTe1TargetSharesReproducePositionConcentration`
    — 10k-snap calibration. WR1 / WR2 / WR3 are symmetric in attributes; target share among WRs
    stays inside `position-concentration.json`'s `wr_target_share.top1_share` p10–p90 window.
    Same for TE1 share among TEs. WRs carry the lion's share of throw targets vs. TEs / RBs.

## Forbidden

- Editing the sealed `PlayEvent` union or the `PlayOutcome` variants.
- Per-receiver completion / catch / YAC rolls — still one aggregate outcome-mix roll in R5.
- Pass-rush sub-roll that wires the `Sack` / `Scramble` `TargetChoice` branches — the selector
  declares those variants but today only returns `Throw` (and `Throwaway` when no route runners
  are present).
- Writing under `resolver.pass.matchup` in `sim-coefficients.json` (same as R3).
- Any ST / O / D work.
- Touching `BaselinePassResolver`.

## Key design notes

- **Scoring formula.** `score_i = m_route_i + depth_value_i + tier_bias_i + σ(qb) · N(0, 1)`. The
  tier bias (WR > TE > RB) fills the `progression_bias` role from the doc; within a tier
  receivers are symmetric, so intra-tier target share is noise-driven, which reproduces the
  position-concentration shape without an explicit "WR1 share" knob.
- **`m_route_i` scope.** R5 uses a two-axis skill delta (`routeRunning + hands` vs. `coverageTechnique`)
  centered to `[-1, +1]` — same scaling as `ClampedPassMatchupShift`. Physical-fit clamping is
  the pass-matchup shift's job; duplicating it inside the selector would double-count the signal.
- **σ(processing, footballIq).** Decreasing in `(processing + footballIq) / 2`. 0.35 at average,
  0.10 at elite, 0.70 at floor — piecewise-linear. High-IQ QBs find the open receiver; low-IQ
  QBs miss the read. The curve is a tunable, not a free parameter: calibration gaps doc will
  flag when `bigdatabowl` data refines it.
- **Byte-for-byte parity is structural, not default-wiring.** The default `ScoreBasedTargetSelector`
  consumes one `nextGaussian()` per candidate receiver from the parent RNG, which shifts the
  stream. The R3 parity property — *the matchup resolver is semantically identical to the
  baseline when shift = 0* — is preserved by swapping in a deterministic
  `FirstRouteRunnerTargetSelector` (test-only fake) that picks the first route runner and
  consumes no randomness. The renamed parity test documents this in a leading comment.
- **RNG interface expansion.** `RandomSource.nextGaussian()` joins `nextLong` / `nextDouble` /
  `split`. Production `SplittableRandomSource` delegates to `SplittableRandom.nextGaussian()`;
  the test `FakeRandomSource` reads from the same scripted doubles list as `nextDouble()`.

## Tests

1. `resolve_zeroShiftWithFirstRouteRunnerSelector_matchesBaselineResolverByteForByte` — 1k snaps,
   same seed, `MatchupPassResolver` + `FirstRouteRunnerTargetSelector` reproduces
   `BaselinePassResolver` byte-for-byte.
2. `resolve_positiveShiftOnComplete_raisesCompletionRate` — unchanged from R3; validates the
   `PassMatchupShift` pathway still lifts completion rate when β > 0.
3. `resolve_equalAttributeRoster_wr1AndTe1TargetSharesReproducePositionConcentration` — 10k
   snaps on a hand-built roster with 3 WRs, 2 TEs, 1 RB. WR1 target share among WRs falls in the
   band's p10–p90 `[0.283, 0.467]` window. TE1 share among TEs falls in p10–p75 `[0.429, 0.767]`.
   WRs out-target TEs.
4. `resolve_withoutQB_throwsIllegalState` — unchanged.

## Definition of done

- All four tests above pass.
- `./gradlew spotlessApply && ./gradlew spotlessCheck test` green.
- `git diff --stat` restricted to **Owns** plus this brief (and any INDEX.md stub promotion).
