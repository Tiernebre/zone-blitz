# Add a cross-feature seam

When one feature needs a behavior from another feature that *isn't* a single-method use case — a daily tick, a factory, a strategy keyed on phase, a profile lookup — you're adding a **cross-feature seam**. The seam lives at the target feature's package root (its public surface), the implementation stays feature-internal, and consumers depend only on the interface.

See also:
- [`add-a-use-case.md`](add-a-use-case.md) — for the single-public-method use-case shape. Start there first; if the behavior fits, you don't need this playbook.
- [`add-a-sim-seam.md`](add-a-sim-seam.md) — for seams *inside* the game-simulator source set.
- [`../technical/feature-map.md`](../technical/feature-map.md) — the current cross-feature seam table.

## When to use this over a use case

| Shape | Use the use-case playbook | Use this playbook |
|---|---|---|
| One caller-facing method returning a sealed `Result` | ✅ | |
| A port behind a daily tick / scheduler | | ✅ |
| A strategy selected by enum (one impl per variant) | | ✅ |
| A read-side profile / projection used across features | | ✅ |
| A factory consumed by a `@Configuration` | | ✅ |

Canonical examples already in the tree:
- [`OfferResolver`](../../src/main/java/app/zoneblitz/league/hiring/OfferResolver.java) — daily tick, consumed by `AdvanceDayUseCase`.
- [`CpuTeamStrategy`](../../src/main/java/app/zoneblitz/league/team/CpuTeamStrategy.java) — phase-keyed strategy, resolved by `AdvanceDayUseCase` via a `Map<LeaguePhase, CpuTeamStrategy>`.
- [`TeamProfiles`](../../src/main/java/app/zoneblitz/league/team/TeamProfiles.java) — read-side profile, consumed by offer scoring.
- [`GenerateCandidatePool`](../../src/main/java/app/zoneblitz/league/hiring/GenerateCandidatePool.java), [`AssembleStaff`](../../src/main/java/app/zoneblitz/league/hiring/AssembleStaff.java), [`FindCandidate`](../../src/main/java/app/zoneblitz/league/hiring/FindCandidate.java) — hiring's cross-feature seams (all are `public interface` at the hiring package root).

---

## 1. Place the interface at the target feature's package root

File: `src/main/java/app/zoneblitz/<target-feature>/<Name>.java`. **Public** visibility.

The outer package is the feature's public surface. Do **not** place the interface in a sub-package — that makes it feature-internal (and for `hiring/` will be rejected by the `hiringInternals_areNotImportedByOtherPackages` ArchUnit rule).

Javadoc the contract exhaustively. Cross-feature consumers will only see the interface — they need:
- What each method does.
- When it's called (tick? phase entry? request-time?).
- Side-effect boundary (writes? reads?).
- Determinism guarantee if any (seeded RNG? idempotent?).
- Transaction expectations (caller's transaction? own?).

Canonical shape, [`OfferResolver.java`](../../src/main/java/app/zoneblitz/league/hiring/OfferResolver.java):

```java
package app.zoneblitz.league.hiring;

/**
 * Seam invoked on each day tick … Idempotent: running twice on the same day is safe.
 */
public interface OfferResolver {
  void resolve(long leagueId, LeaguePhase phase, int dayAtResolve);
}
```

## 2. Implement in the sub-package that owns the data

File: `src/main/java/app/zoneblitz/<target-feature>/<owning-subpackage>/<DistinguishingTrait>.java`. **Package-private**.

Name by distinguishing trait — `PreferenceScoringOfferResolver`, `CityTeamProfiles`, `CpuHiringStrategy`, `BestFitHiringAutofill`. **Never `*Impl`.** Never `*UseCase` (that suffix is reserved for use-case impls, see CLAUDE.md Naming).

Dependencies constructor-injected, typed as **their** interfaces. `@Component` or `@Service` so component scan picks it up.

## 3. Wire it

- **Single implementation** — `@Component` on the impl is enough.
- **Multiple implementations selected by enum** (`CpuTeamStrategy` per phase, `PhaseTransitionHandler` per phase) — use constructor injection of `List<T>` or `Map<EnumKey, T>` at the consumer, and each impl exposes its key via an interface method. See [`AdvanceDayUseCase`](../../src/main/java/app/zoneblitz/league/AdvanceDayUseCase.java) for the `Map<LeaguePhase, ...>` pattern.
- **Variant needs construction args the container can't resolve** (a phase enum, a band file path) — add an explicit `@Bean` method in the target feature's `*Beans` class. See [`HiringBeans`](../../src/main/java/app/zoneblitz/league/hiring/HiringBeans.java) producing one `CpuTeamStrategy` bean per hiring phase.

## 4. Update the feature map

Add a row to [`docs/technical/feature-map.md`](../technical/feature-map.md) — the "Cross-feature seams" table. One line: who consumes it, what it does. This is the canonical index agents and humans both scan.

## 5. (If applicable) tighten with ArchUnit

If the new seam replaces a cross-feature leak you just closed, consider whether the closure can be mechanized. The `hiringInternals_areNotImportedByOtherPackages` rule in [`ArchitectureTests`](../../src/test/java/app/zoneblitz/architecture/ArchitectureTests.java) is the template: outsiders may import the package root but not sub-packages. Add an analogous rule for the target feature if it has feature-internal sub-packages and is likely to grow cross-feature consumers.

If the code on `main` doesn't already satisfy the rule, **don't commit the rule disabled** — commit the refactor that makes it pass, then the rule.

## 6. Test the implementation (not the interface)

DB-touching implementations: `@JooqTest` + `@Import(PostgresTestcontainer.class)`, wired manually in `@BeforeEach` over real `Jooq*Repository` instances. **No `InMemory*Repository`, no Mockito-stubbed repositories** — CLAUDE.md "DB-touching code always uses Testcontainers" is binding.

Pure logic implementations (scoring, selection, preference math): plain unit tests against a seeded `FakeRandomSource`. See [`src/test/java/app/zoneblitz/league/FakeRandomSource.java`](../../src/test/java/app/zoneblitz/league/FakeRandomSource.java).

The consumer has its own tests. For a new `OfferResolver`, `PreferenceScoringOfferResolverTests` covers the seam's behavior; `AdvanceDayUseCaseTests` covers the consumer wiring.

## Checklist — done when

- [ ] Interface at target feature's package root, `public`, with contract-level Javadoc (purpose, when called, side effects, determinism, transaction expectations).
- [ ] Implementation package-private in the owning sub-package, named by distinguishing trait (no `*Impl`).
- [ ] `@Component` / `@Service` on the impl; multi-impl variants keyed by enum via `Map<K, T>` injection.
- [ ] Consumer depends on the **interface**, not the concrete type. Constructor-injected.
- [ ] Cross-feature seams table in `feature-map.md` updated with a new row.
- [ ] ArchUnit rule added if the seam formalizes a feature boundary and can be mechanized.
- [ ] Tests: implementation under Testcontainers if DB-touching, pure unit test with seeded RNG if not.
- [ ] `./verify` passes.
