# F2 — band sampler

**Deps:** F1. **Unblocks:** R1, R2, ST1-ST5.

## Goal

Single chokepoint for sampling any band. Two paths: rate bands (weighted choice + log-odds matchup shift) and distributional bands (percentile-ladder inversion + percentile shift). Baseline sampling with no matchup shift reproduces any band within 99% Wilson CI over 10k samples.

## Doc context

- `sim-engine.md` lines 86-117 (band sampling)
- Skim `data/bands/passing-plays.json` + `data/bands/rushing-plays.json` to understand the on-disk shape.

## Owns

- `src/main/java/app/zoneblitz/sim/BandSampler.java` — interface:
  - `<T> T sampleRate(RateBand<T> band, double matchupShift, RandomSource rng)`
  - `int sampleDistribution(DistributionalBand band, double matchupShift, RandomSource rng)`
- `src/main/java/app/zoneblitz/sim/DefaultBandSampler.java` — impl. Logit math for rates, percentile interpolation for distributions.
- `src/main/java/app/zoneblitz/sim/RateBand.java` — record: `Map<T, Double> baseProbabilities`, `Map<T, Double> matchupCoefficients` (β per outcome).
- `src/main/java/app/zoneblitz/sim/DistributionalBand.java` — record: `int min, max`, `SortedMap<Double, Double> percentileLadder` (p10..p90), `double gamma` (percentile shift coefficient).
- `src/main/java/app/zoneblitz/sim/BandRepository.java` — interface: `RateBand<T> loadRate(String path, Class<T> outcomeType)`, `DistributionalBand loadDistribution(String path, String fieldPath)`. Classpath JSON loader.
- `src/main/java/app/zoneblitz/sim/ClasspathBandRepository.java` — impl over Jackson. Reads from `classpath:bands/` (bands resource directory or copied from `data/bands/` — pick one; current project wiring will tell you).
- Tests: `BandSamplerCalibrationTests` — 10k samples, assert distribution matches band within CI. Use `passing-plays.json:outcome_mix` and `completion_yards` as the test fixtures.

## Forbidden

- Consuming bands from a resolver. That's R1.
- Any coefficient values other than 0 (identity). Matchup shifts are plumbing-only in F2.
- Writing to `data/bands/` — read-only.

## Key design notes

- **Logit shift for rates:** `logit(p') = logit(p_base) + Σ β_i × m_i`, renormalize. Implement carefully around `p=0` and `p=1` (use `ε` clamp).
- **Percentile shift for distributions:** `u' = clamp(u + γ × m, ε, 1-ε)`, then linear interpolate on the percentile ladder. Respect `min`/`max` as hard clamps.
- **Single chokepoint:** any future sim code that samples from a band must go through `BandSampler`. No direct JSON reads in resolvers/models.

## Tests

1. `sampleRate_zeroShift_reproducesBaseProbabilities` — 10k samples from `outcome_mix`, Wilson CI check per outcome.
2. `sampleRate_positiveShiftOnOutcome_increasesThatOutcomeFrequency` — sanity direction check.
3. `sampleDistribution_zeroShift_reproducesPercentiles` — 10k samples, check p10/p25/p50/p75/p90 within bootstrap CI.
4. `sampleDistribution_respectsMinMax` — 1M samples never violate min/max.
5. `sampleDistribution_positiveShift_raisesMedian` — direction check.
6. `ClasspathBandRepositoryTests.loadRate_passingPlays_outcomeMix_parses`.

## Definition of done

- 6 tests above pass.
- Spotless + full test suite green.
- `git diff --stat` restricted to **Owns**.
