# Hiring

Candidate pool generation, interviews, offers, counter-offers, and the hire transaction for coaches and scouts across the `HIRING_HEAD_COACH` and `HIRING_DIRECTOR_OF_SCOUTING` phases. The feature owns the hidden-info contract (true ratings never leak into price signals or UI), the per-tick offer resolver, and the staff-salary-cap check that gates every offer and match.

## Public API

The types below are the feature's contract. Anything in the sub-packages (`candidates/`, `generation/`, `interview/`, `offer/`, `hire/`, `view/`) is feature-internal and must not be imported from outside hiring.

### Use cases

- `MakeOffer` — submit or revise an offer against a candidate. Returns `MakeOfferResult`.
- `MatchCounterOffer` — accept the competing offer's terms onto a counter-pending offer. Returns `MatchCounterOfferResult`.
- `DeclineCounterOffer` — walk from a counter-pending offer. Returns `DeclineCounterOfferResult`.
- `HireCandidate` — finalize the hire once an offer's stance is `AGREED`. Returns `HireCandidateResult`.
- `StartInterview` — record one interview against a shortlisted candidate, tightening the scouted-signal noise. Returns `InterviewResult`.
- `ViewHeadCoachHiring` — load the HC hiring page view-model. Returns `Optional<HeadCoachHiringView>`.
- `ViewHeadCoachHiringSummary` — load the post-HC summary page. Returns `Optional<HeadCoachHiringSummaryView>`.
- `ViewDirectorOfScoutingHiring` — load the DoS hiring page view-model. Returns `Optional<DirectorOfScoutingHiringView>`.
- `ViewDirectorOfScoutingHiringSummary` — load the post-DoS summary page. Returns `Optional<DirectorOfScoutingHiringSummaryView>`.

### Seams (consumed across sub-packages and by phase handlers)

- `CandidateGenerator` — generate a pool for a given phase (one implementation per candidate kind; lives in `generation/`).
- `CoordinatorCandidateGenerator`, `PositionCoachCandidateGenerator`, `ScoutCandidatePoolGenerator` — specialty-parameterized generators.
- `CandidateRandomSources` — factory for a deterministic `RandomSource` keyed by `(leagueId, phase)`.

### Shared records / enums

- `Candidate`, `NewCandidate`, `GeneratedCandidate` — candidate aggregate (read-side, insert-side, and generator output).
- `CandidatePool`, `CandidatePoolType`, `CandidatePreferences` — pool + per-candidate preferences row.
- `CandidateArchetype`, `CandidateKind`, `CompetitiveWindow`, `ScoutBranch`, `InterviewInterest` — categorical tags.
- `OfferTerms`, `CandidateOffer`, `OfferStance`, `OfferStatus` — offer value objects.
- `OfferView`, `CounterDetails` — view-layer records for offer rendering.
- `StaffContract`, `StaffBudget`, `LeagueHire` — post-hire records surfaced to consumers (staff, recap views).

### Wiring

- `HiringBeans` — `@Configuration` that produces one `CpuTeamStrategy` bean per hiring phase (HC and DoS) over the single `CpuHiringStrategy` implementation.

## Internal structure

Each sub-package is flat and package-private. The outer package is the public surface; cross-cutting types (records, enums, use-case interfaces) live there.

- `candidates/` — candidate, pool, and preferences persistence (`CandidateRepository`, `CandidatePoolRepository`, `CandidatePreferencesRepository`, their `Jooq*` adapters, `SplittableCandidateRandomSources`, `CandidatePreferencesDraft`).
- `generation/` — pool generators (`HeadCoachGenerator`, `DirectorOfScoutingGenerator`, `CoordinatorGenerator`, `PositionCoachGenerator`, `ScoutCandidateGenerator`), market-band files (`HeadCoachMarketBands`, `ScoutMarketBands`, `StaffMarketBands`), and salary/guarantee/contract-length bands plus `StaffPreferencesFactory`.
- `interview/` — `StartInterviewUseCase`, `TeamInterview`, `TeamInterviewRepository` + `Jooq` adapter, `NewTeamInterview`.
- `offer/` — `MakeOfferUseCase`, `MatchCounterOfferUseCase`, `DeclineCounterOfferUseCase`, `OfferResolver` + `PreferenceScoringOfferResolver`, `OfferScoring`, `StanceEvaluator`, `OfferTermsJson`, `CandidateOfferRepository` + `Jooq` adapter.
- `hire/` — `HireCandidateUseCase`, `CpuHiringStrategy` (`CpuTeamStrategy` for hiring phases), `InterestScoring`, `StaffContractFactory`, `NewStaffContract`, `StaffContractRepository`, `StaffBudgetRepository`, `LeagueHires`, and their `Jooq` adapters.
- `view/` — `HiringHeadCoachController`, `HiringDirectorOfScoutingController`, `HeadCoachHiringSummaryController`, `DirectorOfScoutingHiringSummaryController`, the matching `*HiringView` / `*CandidateView` records, `*ViewModel` assemblers, `*UseCase` implementations of the `View*` interfaces, and `MakeOfferForm`.

## Extending

- Adding a new use case: see [`docs/playbooks/add-a-use-case.md`](../../../../../../../docs/playbooks/add-a-use-case.md). Place the interface + `*Result` sealed union at this package root; place the implementation in the sub-package whose data it owns (offer/hire/interview/view).
- Adding a new generator: implement `CandidateGenerator` (or the specialty-parameterized variant), keep it package-private in `generation/`, and register a `@Component`. Follow the hidden-info contract in the `CandidateGenerator` Javadoc.
- Adding a new offer outcome: extend the relevant sealed `*Result` union; the compiler will list every exhaustive switch to update.
- Tuning salaries / contract lengths: edit the band files under `generation/*MarketBands.java` and `data/bands/` rather than hard-coding values at a call site.

## Tests

Tests mirror the sub-package layout under `src/test/java/app/zoneblitz/league/hiring/{candidates,generation,interview,offer,hire,view}/`. Slice-test types:

- Repositories and repository-backed use cases — `@JooqTest` + `@Import(PostgresTestcontainer.class)`, wired manually in `@BeforeEach` against real `Jooq*` adapters.
- Controllers — `@WebMvcTest` with `@MockitoBean` for the use-case interface.
- Pure generators / scoring helpers — plain unit tests against a seeded `RandomSource`.

Builders: `StaffContractBuilder` in `hire/`, `OfferTermsBuilder` in `offer/`. Add new builders next to the tests that need them.

## Design docs

- [`docs/technical/staff-market-implementation.md`](../../../../../../../docs/technical/staff-market-implementation.md) — staff-cap + counter-offer blueprint driving this feature.
- [`docs/technical/league-phases.md`](../../../../../../../docs/technical/league-phases.md) — phase state machine, hiring sub-state, preference scoring schema.
- [`CLAUDE.md`](../../../../../../../CLAUDE.md) — project-wide conventions.

## Known seams to tighten

The hiring-internal ArchUnit rule `hiringInternals_areNotImportedByOtherPackages` in [`ArchitectureTests.java`](../../../../../../../src/test/java/app/zoneblitz/architecture/ArchitectureTests.java) is `@Disabled` because three legitimate cross-feature consumers still reach into sub-packages:

- `league.AdvanceDayUseCase` depends on `offer.OfferResolver`.
- `league.phase.Hiring*TransitionHandler` (HeadCoach, DirectorOfScouting, AssemblingStaff) depends on `candidates.CandidatePoolRepository`, `CandidateRepository`, `CandidatePreferencesRepository` for phase-entry pool generation.
- `league.phase.BestFitHiringAutofill` pulls in `offer.InterestScoring / OfferScoring / OfferStance / OfferTermsJson / PreferenceScoringOfferResolver`.

Follow-up: promote hiring-public use cases for "generate candidate pool for phase" and "fetch hired candidate by id"; then enable the rule.
