# Agent-friendliness audit

_Point-in-time audit (2026-04-22) framed around making this repo easier for **less-capable coding agents** to work in. Captures findings, rationale, and a ranked optimization plan._

If code and this doc disagree, read the code and update the doc. If [`CLAUDE.md`](../../CLAUDE.md) and this doc disagree, `CLAUDE.md` wins — this audit measures adherence to it, not competing advice.

## Implementation status (2026-04-22)

Most of the plan landed the same day the audit was written, in one bundled PR. **The scorecard and "what breaks for a weak agent today" sections below describe the pre-refactor baseline** — consult the code for current state.

| Plan item | Status |
|---|---|
| 1. Hide hiring internals (package-private) | **shipped** — 26 types dropped to package-private inside the new sub-packages |
| 2. Split `hiring/` into sub-feature packages | **shipped** — `candidates/`, `generation/`, `interview/`, `offer/`, `hire/`, `view/` |
| 3. Per-feature READMEs + `package-info.java` | **shipped** — hiring (+6 sub-pkg), phase, staff, team, gamesimulator |
| 4. Generator interfaces + `CpuTeamStrategy` consumer typing | **shipped** — 3 new interfaces; `PreferenceScoringOfferResolver` fixed |
| 5. ArchUnit guardrails | **shipped** — 9 live rules in `src/test/java/app/zoneblitz/architecture/`, including test-name enforcement; no `@Disabled` remain |
| 6. Test data builders + test naming rule | **shipped** — 5 builders added earlier; `testMethods_followUnderscoreNamingConvention` ArchUnit rule enforces `methodUnderTest_condition_expectedOutcome` (minimum: at least one underscore) |
| 7. Real repo root `README.md` | **shipped** — ~60-line onramp |
| 8. "How to add X" playbooks | **shipped** — `add-a-use-case`, `add-a-league-phase`, `add-a-sim-seam` under `docs/playbooks/` |
| 9. Smaller tidies (impl naming, `league/` root watch) | **shipped** — `CLAUDE.md` "Naming" documents the `*UseCase`-suffix convention; `league/` root dropped from 24→16 public types by hiding `*UseCase` impls, controller, repository adapter, `LeagueBeans`, and the three `LeagueTable*` records |

The three cross-feature leaks originally punted from the hiring refactor (listed in the `hiringInternals_areNotImportedByOtherPackages` rule) were **closed in the follow-up pass** — each replaced with a hiring-public use-case seam: `OfferResolver`, `GenerateCandidatePool` / `FindCandidate` / `AssembleStaff`, and `BestFitHiringAutofill` moved into `hiring/hire/`. The ArchUnit rule is now live (not `@Disabled`), enforcing the boundary going forward. The `view/` sub-package is now fully internal — its use-case interfaces, view models, and page records all live and stay inside `view/`, with no cross-package consumers.

---

---

## Headline

The codebase is well-engineered for a capable engineer but hostile to a weak agent. The conventions in `CLAUDE.md` are excellent and largely followed for discipline rules (Testcontainers, no `Math.random`, no bare `TODO`, Javadoc on public interfaces) — **but the single most load-bearing rule for agent ergonomics, "a feature's public surface is its use-case interfaces and records; everything else package-private", is violated at scale.** That one failure cascades into every other agent-friendliness problem.

---

## Scorecard

| Signal | Value | Target | Verdict |
|---|---|---|---|
| Public top-level declarations vs package-private | 301 / 57 | roughly inverted — per feature only use-cases + shared records should be public | red |
| Files in `league.hiring` | 100 (81 public) | ≤ ~20 per package (CLAUDE.md: "split into sub-features" beyond that) | red |
| Feature-level README / CLAUDE.md files | 0 | one per non-trivial feature (CLAUDE.md encourages this) | red |
| Repo root `README.md` | 14 bytes | onboarding hook for a fresh agent | red |
| Test data builders | 1 (`StaffContractBuilder`) | co-located with each shared domain record | yellow |
| Test naming `method_condition_outcome` | ~18% of 613 tests | enforced, not by discipline | yellow |
| `TODO` / `FIXME` hygiene | 0 bare | — | green |
| DB tests via Testcontainers, no mocked repos | 100% | — | green |
| `Math.random` / `new Random()` / `ThreadLocalRandom` | 0 | — | green |
| Javadoc on sampled public interfaces | 12/12 | — | green |
| `gamesimulator` → `league` imports | 0 | clean one-way dependency | green |
| `e2e` Playwright scope | 2 tests, tagged, isolated task | disciplined | green |

---

## Method

Four parallel passes, each scoped to one dimension:

1. **Package encapsulation** — public vs package-private declarations per feature; cross-feature leakage of internals; presence of banned layer-folder subpackages (`domain/`, `service/`, `data/`, `web/`); `gamesimulator` boundary integrity.
2. **ITDD adherence** — behavior classes lacking interfaces; consumer-side fields typed as concretes rather than interfaces; `*Impl` / `Default*` naming; seeded-RNG discipline.
3. **Testing discipline** — DB-test integrity, use-case test style, test data builder adoption, test naming conformance, Mockito-vs-fakes balance, largest test file organization, Playwright scope.
4. **Documentation affordances** — Javadoc coverage, docs-code drift across the three technical design docs, presence of feature-level orientation, `TODO`/`FIXME` hygiene, agent-navigation affordances (playbooks, inventories, diagrams).

---

## What breaks for a weak agent today

Each problem framed as the mistake a weak agent makes.

### 1. A weak agent can't find the front door of a feature

In `app.zoneblitz.league.hiring`, 81 of 100 files are `public`. An agent greping "what does hiring expose" sees `JooqCandidateRepository`, `StanceEvaluator`, `OfferTermsJson`, `InterestScoring`, `HeadCoachGenerator`, `PreferenceScoringOfferResolver`, and ~75 others. The actual contract — the ~6 use-case interfaces `MakeOffer`, `HireCandidate`, `StartInterview`, `DeclineCounterOffer`, `MatchCounterOffer`, `ViewHeadCoachHiring` — drowns in the noise. The weak agent picks `PreferenceScoringOfferResolver` as the dependency to inject, because it looks canonical.

This failure mode is already in production:

- `src/main/java/app/zoneblitz/league/LeagueBeans.java:8-13` wires six concrete generators (`HeadCoachGenerator`, `DirectorOfScoutingGenerator`, `CoordinatorGenerator`, `PositionCoachGenerator`, `ScoutCandidateGenerator`) directly, because there's no interface to wire against.
- `src/main/java/app/zoneblitz/league/phase/BestFitHiringAutofill.java` imports 16 hiring internals including `InterestScoring`, `OfferStance`, `OfferTermsJson`, `PreferenceScoringOfferResolver` — a cross-feature consumer reaching across a boundary that was never made private.

### 2. A 100-file flat package blows context

`CLAUDE.md:163`: _"If a feature genuinely outgrows a flat package, split it into sub-features."_ `hiring/` outgrew it ~80 files ago. Four clear sub-feature clusters exist in the files already:

- **candidates/** — `Candidate`, `CandidatePool`, `CandidatePoolType`, `CandidatePreferences`, `CandidateArchetype`, repos (~12 files)
- **generation/** — `HeadCoachGenerator`, `DirectorOfScoutingGenerator`, `CoordinatorGenerator`, `PositionCoachGenerator`, `ScoutCandidateGenerator`, `*MarketBands`, `StaffPreferencesFactory`, RNG splitters (~18 files)
- **interview/** — `StartInterview` + use case, `TeamInterview`, `InterviewResult`, `InterviewInterest`, repo (~7 files)
- **offer/** — `MakeOffer` / `MatchCounterOffer` / `DeclineCounterOffer` use cases + results, `OfferTerms`, `OfferStance`, `OfferStatus`, `OfferResolver`, `OfferScoring`, `StanceEvaluator`, `PreferenceScoringOfferResolver`, `CounterDetails`, `CandidateOffer` (~18 files)
- **hire/** — `HireCandidate` + use case + result, `LeagueHire`, `StaffContract*`, `StaffBudget*`, `NewStaffContract`, `CpuHiringStrategy` (~15 files)
- **view/** — controllers, view models, view records for HC + DoS (~15 files)

### 3. Consumer-side concrete types

`src/main/java/app/zoneblitz/league/hiring/PreferenceScoringOfferResolver.java:65` declares `private final List<CpuHiringStrategy> cpuStrategies;`, but `CpuHiringStrategy` implements the `CpuTeamStrategy` interface. The consumer is locked to the concrete. A weak agent copying this pattern writes the same bug again.

Three generators also lack interfaces entirely — `CoordinatorGenerator`, `ScoutCandidateGenerator`, `PositionCoachGenerator`. Consumers (e.g. `HiringAssemblingStaffTransitionHandler:78-80`) must type against the concretes.

### 4. No "where do I start" on-ramp

- Repo-root `README.md` is two lines.
- No per-feature READMEs. None. `CLAUDE.md:376` encourages "README per feature package when it aids orientation" — unfollowed.
- No playbooks for the common extensions (new use case, new phase, new Result variant, new repository, new sim seam).
- The `docs/technical/*` design docs are good but describe intent, not mechanics.

A weak agent entering `league/phase` reverse-engineers what a phase-transition handler is by reading `HiringAssemblingStaffTransitionHandler.java` (335 LOC).

### 5. No test-data-builder habit

Exactly one test builder exists (`StaffContractBuilder`). Every other test inline-constructs fixtures. A weak agent copying an existing test copies the inline-construction pattern, so fixture duplication compounds, and refactoring any domain record becomes a sweep across 100+ test methods.

### 6. Test naming is unenforced

~18% of 613 tests follow `methodUnderTest_condition_expectedOutcome`. A weak agent reads three tests, sees three different naming styles, and picks whichever looks closest to the case at hand. No tool enforces the rule; drift is one-way.

### 7. No executable architecture guardrails

`CLAUDE.md` bans things the compiler doesn't catch: "jOOQ records never cross the data-layer boundary", "controllers never reference persistence types", "no cross-feature imports of internals", "500 LOC hard ceiling". A weak agent violates these every time, and nothing stops them except a reviewer. Two (encapsulation leak, LOC ceiling) are already violated in main.

---

## Optimization plan — ranked by weak-agent impact

Items 1–3 are the big unlocks. Everything else amplifies them.

### 1. Hide the hiring internals (and every other feature's internals)

Make all repository adapters, use-case implementations, generators, view models, stance/scoring helpers, and controllers **package-private**. Keep public: use-case interfaces, `*Result` sealed unions, shared domain records (`Candidate`, `OfferTerms`, `StaffContract`, etc.), and any repository interfaces another feature provably needs (ideally none).

Expected outcome: `grep "^public " src/main/java/app/zoneblitz/league/hiring/` drops from 81 to ~20. `LeagueBeans` will break — that's the signal that `CpuHiringStrategy` needs an interface, or its beans move into the hiring package.

**Why this helps weak agents:** they grep for the type to depend on, and there are ~20 options, all contracts.

### 2. Split `hiring/` into sub-feature sub-packages

```
app.zoneblitz.league.hiring
  ├── HireCandidate, MakeOffer, MatchCounterOffer, DeclineCounterOffer,
  │     StartInterview, ViewHeadCoachHiring, ViewDirectorOfScoutingHiring,
  │     *Result unions, shared Candidate / OfferTerms / StaffContract records   — public surface only
  ├── candidates/            (Candidate, pool, preferences, repos)
  ├── generation/            (all *Generator + *MarketBands + factories)
  ├── interview/             (StartInterviewUseCase, TeamInterview, repos)
  ├── offer/                 (use cases, resolver, scoring, stance)
  ├── hire/                  (HireCandidateUseCase, contracts, budget, CPU strategy)
  └── view/                  (controllers, view models, view records)
```

Each sub-package is flat and package-private. The outer `hiring/` package is the public API (interfaces + records). Hiring is the first feature to cross the ~20-file threshold; the split it needs is the model other features will follow when they get there.

**Why this helps weak agents:** `ls hiring/` shows 20 contract files, not 100. `ls hiring/offer/` shows the offer cluster.

### 3. Give every non-trivial feature a `package-info.java` and a `README.md`

- **`package-info.java`** — one-paragraph Javadoc per feature root linking to the use-case interfaces. Renders in IDEs; part of the package for LLMs.
- **`README.md`** — one per non-trivial feature (hiring, phase, gamesimulator, staff, team). Template:
  ```markdown
  # <Feature>
  ## Purpose (one paragraph)
  ## Public use cases (bulleted list with link)
  ## Internal seams (key interfaces/types inside; where to extend)
  ## How to add a new X (3–5 bullets)
  ## Where the tests live
  ```

**Why this helps weak agents:** the first thing a weak agent does when told "touch hiring" is `ls` and `cat README.md`. This is the orientation layer that doesn't exist today.

### 4. Promote generators and CPU strategy to interfaces

- `CandidateGenerator` already exists — make `HeadCoachGenerator`, `DirectorOfScoutingGenerator`, `CoordinatorGenerator`, `PositionCoachGenerator`, `ScoutCandidateGenerator` all implement it. Give them package-private visibility.
- Fix `PreferenceScoringOfferResolver.java:65` to take `List<CpuTeamStrategy>`, not `List<CpuHiringStrategy>`.

**Why this helps weak agents:** the wiring config shrinks to beans-of-interfaces, and a weak agent copying it copies the right pattern.

### 5. Install ArchUnit as an executable architecture guard

One test file (`ArchitectureTests.java`) that fails the build when any of these rules break:

- Classes outside feature package X must not import a package-private or non-use-case-interface type from X.
- Classes annotated `@Controller` must not import types under `app.zoneblitz.jooq.*` or any `*Repository*`.
- Repository methods must not return a type from `app.zoneblitz.jooq.*`.
- No class uses `java.util.Random`, `Math#random`, or `ThreadLocalRandom` (except inside `gamesimulator.rng`).
- No file > 500 LOC.

**Why this helps weak agents:** every mistake the weak agent would make gets caught at `./gradlew test`, not at review. This removes a huge class of failure modes in one shot.

### 6. Expand test data builders; enforce test naming

- **Builders.** One per shared domain record — `aCandidate()`, `aTeam()`, `aLeague()`, `aFranchise()`, `anOfferTerms()`, `aStaffContract()`, `aHeadCoach()`. Co-locate in `src/test/java` next to the record. Start with the five most-inline-constructed records; grep to rank.
- **Naming.** Spotless / checkstyle / ArchUnit rule: test method names must match `^[a-z][a-zA-Z0-9]+_[a-zA-Z0-9_]+$` (at least one underscore). Imperfect, but flags the worst offenders.

**Why this helps weak agents:** when every existing test uses a builder, they use a builder. When CI rejects bad test names, they write good ones.

### 7. Write a real repo root `README.md`

Treat it as the agent on-ramp (~80 lines):

- 3-sentence product overview
- Tech stack paragraph (currently in `docs/tech-stack.md`)
- How to run (`./gradlew bootRun`, `./dev`, `docker compose up`)
- Where the conventions live (`CLAUDE.md`)
- Feature map: one line per top-level feature package
- Links to the three technical design docs + this audit

The current two-line `README.md` is the first file an agent reads. It's a missed opportunity.

### 8. Add 3–5 "how to add X" playbooks

Short (100–200 lines each), in `docs/playbooks/`:

- `add-a-use-case.md` — interface, use-case class with `@Component`, Result sealed union, controller wiring, slice test.
- `add-a-league-phase.md` — enum variant, `PhaseTransitionHandler` impl, registration, tests.
- `add-a-result-variant.md` — add to sealed interface, extend exhaustive switches, add test.
- `add-a-sim-seam.md` — interface, `SimConfiguration` wiring, calibration test against a named band.

**Why this helps weak agents:** each is a path where the weak agent would otherwise copy-paste from whichever random example they greped. Playbooks produce consistent output.

### 9. Smaller tidies

- **Impl-naming scheme.** `StartInterview` (iface) + `StartInterviewUseCase` (impl) is one style; `CpuTeamStrategy` (iface) + `CpuHiringStrategy` (impl) is another. Document one in `CLAUDE.md` and either make `*UseCase` universal or drop it.
- **`league/` root is 24 files.** Probably fine, but it's starting to look like hiring did ~40 files ago. When the split comes, the seams are likely `league/lifecycle/` (Create/Delete/Get), `league/advance/` (Advance/AdvanceDay), plus cross-cutting config.
- **Keep `docs/technical/*.md` live.** They're currently accurate and actively maintained — a real asset. Link them from the new root `README.md`.

---

## What's already excellent — don't regress

Calling these out because they should be protected during the refactor:

- **Testcontainers discipline** — zero mocked repos, zero InMemory repos, 100% real Postgres for DB-touching code. Load-bearing, hard to get right once regressed. Any architecture test should cement it.
- **Javadoc on public interfaces** — every sampled interface documents contract and Result variants.
- **RNG discipline** — zero `Math.random` / `new Random()` in 45k lines. ArchUnit should lock it.
- **`gamesimulator` boundary** — it imports nothing from `league`. Preserve the one-way dependency.
- **Thin controllers, sealed `Result` unions pervasive, feature-per-package, constructor injection only, no `*Impl`/`*Manager`/`*Helper`** — consistently followed.

---

## Minimum viable slice

If only one thing ships: do steps **1 + 2 + 3** together, scoped to hiring only, as a single PR. Hiring is the worst offender *and* the template every future feature will copy. Fixing it fixes the blast radius.

Steps 4–8 compound on that foundation, but without 1–3 the system keeps leaking and weak agents keep picking internal classes as canonical dependencies.
