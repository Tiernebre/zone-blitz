# Add a sim seam

Step-by-step recipe for adding a new seam (interface + implementation + calibration test) to the game simulator. Item #8 of [`docs/technical/agent-friendliness-audit.md`](../technical/agent-friendliness-audit.md).

See also [`docs/technical/sim-engine.md`](../technical/sim-engine.md) for the full seam list and architecture. The sim engine lives in its own source set at `src/gamesimulator/java/app/zoneblitz/gamesimulator/` — framework-free by design.

---

## 1. Define the interface

File: `src/gamesimulator/java/app/zoneblitz/gamesimulator/<subpackage>/<Name>.java`. Public when consumers outside the subpackage need it, package-private otherwise.

Javadoc the contract — inputs, output, purity guarantee, which `RandomSource` stage consumes randomness.

Canonical, [`PassResolver.java`](../../src/gamesimulator/java/app/zoneblitz/gamesimulator/resolver/pass/PassResolver.java):

```java
package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;

/**
 * Resolves a pass-shaped play call into a {@link PassOutcome}. Pure given its inputs; all
 * randomness flows through the supplied {@link RandomSource}.
 */
public interface PassResolver {

  /**
   * Resolve the supplied pass play.
   *
   * @param call the offensive play call
   * @param state current game state
   * @param offense 11 offensive players on the field
   * @param defense 11 defensive players on the field
   * @param rng randomness source
   * @return the resolved {@link PassOutcome}
   */
  PassOutcome resolve(
      PlayCaller.PlayCall call,
      GameState state,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      RandomSource rng);
}
```

Key conventions:

- **Every stochastic seam takes `RandomSource`** as a method parameter (not a field). This keeps the seam pure given its inputs, which is what makes games byte-for-byte replayable from a seed.
- **No nullable return types.** Use `Optional<T>` or a sealed union.
- **No framework types.** The `gamesimulator` source set has no Spring dependency.

## 2. Implement

Name the implementation by its distinguishing trait: `MatchupPassResolver` (uses role-based matchup math), `BaselineDefensiveCallSelector` (baseline heuristic), `DistanceCurveFieldGoalResolver` (distance-curve model). No `*Impl` suffix.

If multiple implementations will coexist (probabilistic vs. deterministic for tests), name them accordingly:

- Probabilistic / production: the descriptive name (`MatchupPassResolver`).
- Scripted / fake: `Fake<Name>` or `Scripted<Name>` in `src/test/java`.

For stateless pure seams, a `final class` with package-private or public constructor and interface-typed fields is the default shape.

## 3. Wire via `SimConfiguration`

File: [`src/main/java/app/zoneblitz/gamesimulator/SimConfiguration.java`](../../src/main/java/app/zoneblitz/gamesimulator/SimConfiguration.java).

```java
@Configuration
class SimConfiguration {}
```

At time of writing this is deliberately empty — bean definitions are added as concrete implementations come online. Add `@Bean` methods here when a consumer needs the seam resolved by Spring.

For pure seams used only inside other sim code, direct construction in the consumer's constructor is fine; no Spring bean required. See [`GameSimulator.java`](../../src/gamesimulator/java/app/zoneblitz/gamesimulator/GameSimulator.java) — the full engine is hand-wired via constructor parameters, not `@Autowired`.

`SimConfiguration` lives in `src/main/java` (not the `gamesimulator` source set) specifically so the core sim stays framework-free while the wiring can still use Spring.

## 4. Write a calibration test against a named band

**Every sim seam with randomness must have a calibration test** that asserts its output matches a real-data band from `data/bands/`.

Band loading uses [`ClasspathBandRepository`](../../src/gamesimulator/java/app/zoneblitz/gamesimulator/band/ClasspathBandRepository.java) + [`DefaultBandSampler`](../../src/gamesimulator/java/app/zoneblitz/gamesimulator/band/DefaultBandSampler.java). RNG seeds are hardcoded per test for determinism.

Canonical, [`MatchupPassResolverCalibrationTests.java`](../../src/test/java/app/zoneblitz/gamesimulator/resolver/pass/MatchupPassResolverCalibrationTests.java):

```java
@Execution(ExecutionMode.CONCURRENT)
class MatchupPassResolverCalibrationTests {

  private static final int TRIALS = 10_000;
  private static final PlayCaller.PlayCall PASS_CALL = new PlayCaller.PlayCall("pass");

  private final ClasspathBandRepository repo = new ClasspathBandRepository();
  private final DefaultBandSampler sampler = new DefaultBandSampler();
  private final OffensivePersonnel offense = TestPersonnel.baselineOffense();
  private final DefensivePersonnel defense = TestPersonnel.baselineDefense();

  @Test
  void resolve_zeroShift_outcomeRatesTrackBase() {
    var resolver = loadedResolver(PassMatchupShift.ZERO);
    var counts = sampleCounts(resolver, 99L);

    assertThat(counts.get(PassOutcomeKind.COMPLETE))
        .as("base complete rate ~0.5791 over 10k trials; ±3σ ≈ 5640..5940")
        .isBetween(5500, 6050);
  }

  @Test
  void resolve_forcedComplete_yardagePercentilesMatchBand() {
    var resolver = buildResolver(forcedKind(PassOutcomeKind.COMPLETE), PassMatchupShift.ZERO);
    var yards = sampleYards(resolver, 101L, MatchupPassResolverCalibrationTests::completionYards);
    assertPercentile(yards, 0.10, 2, 1);
    assertPercentile(yards, 0.25, 5, 1);
    assertPercentile(yards, 0.50, 8, 1);
    assertPercentile(yards, 0.75, 14, 1);
    assertPercentile(yards, 0.90, 22, 1);
  }
}
```

Patterns worth copying:

- **Run many trials** (10k is typical) to shrink sampling noise, then assert a tolerance interval — not a point value. The `@Execution(CONCURRENT)` annotation parallelizes across test classes; per-test RNG is seeded, so this stays deterministic.
- **Per-test seed.** `sampleCounts(resolver, 99L)` bakes the seed into the helper; no shared RNG between tests means order-independence.
- **Assert against real bands.** `completion_yards` percentiles come from `data/bands/passing-plays.json`, not invented numbers. The `assertPercentile` helper is in [`CalibrationAssertions.java`](../../src/test/java/app/zoneblitz/gamesimulator/CalibrationAssertions.java).
- **Separate drift-tracking from hard-fail.** Large multi-seam harnesses (see [`DriveOutcomeCalibrationTests.java`](../../src/test/java/app/zoneblitz/gamesimulator/DriveOutcomeCalibrationTests.java)) log delta-from-target without failing the build — the seam-level calibration tests do the failing.

## 5. RNG discipline

- **Never** `Math.random`, `new Random()`, or `ThreadLocalRandom.current()` anywhere in the sim. Enforced by discipline today; audit item #5 tracks adding ArchUnit to enforce automatically.
- Production `RandomSource` is [`SplittableRandomSource`](../../src/gamesimulator/java/app/zoneblitz/gamesimulator/rng/SplittableRandomSource.java); tests use either `new SplittableRandomSource(<seed>)` for reproducibility or a `FakeRandomSource` with scripted draws (see `app.zoneblitz.league.FakeRandomSource`).
- `RandomSource.split(long key)` returns a deterministic child stream keyed by `(parent seed, key)`. Use this when a seam consumes multiple RNGs per call so a later bug fix does not bleed RNG state into earlier plays. `GameSimulator` uses split keys like `CLOCK_SPLIT_KEY`, `PENALTY_PRE_KEY` so each stage has its own deterministic sub-stream — see [`GameSimulator.java`](../../src/gamesimulator/java/app/zoneblitz/gamesimulator/GameSimulator.java) lines 49-58.

---

## Checklist — done when

- [ ] Interface defined in the appropriate `gamesimulator` subpackage, Javadoc documenting contract + which bands calibrate it.
- [ ] `RandomSource` passed as a method parameter (not a field) if the seam is stochastic.
- [ ] Implementation named by distinguishing trait (no `*Impl`).
- [ ] No framework imports in `src/gamesimulator/java/` (Spring stays in `src/main/java`).
- [ ] No `Math.random` / `new Random()` / `ThreadLocalRandom`.
- [ ] Calibration test(s) against a named band file under `data/bands/`, seeded RNG, tolerance interval (not point).
- [ ] `@Bean` in [`SimConfiguration`](../../src/main/java/app/zoneblitz/gamesimulator/SimConfiguration.java) if a Spring consumer resolves the seam.
- [ ] `./gradlew spotlessApply` run; `./gradlew spotlessCheck` passes.
- [ ] `./gradlew test` passes.
