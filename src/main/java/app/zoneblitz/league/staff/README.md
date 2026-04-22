# Staff

Post-hire franchise staff: the coaching and scouting org charts and the league-wide staff-recap page shown after `ASSEMBLING_STAFF` completes. Owns the terminal `TeamStaffMember` aggregate (the row stamped for each hire) and the view-models used by the coaching-staff and recap pages. Candidate generation, interviews, offers, and the hire transaction belong to [`hiring/`](../hiring/README.md); this feature only reads the resulting hires.

## Public API

### Use cases

- `ViewCoachingStaffOrgChart` — load the viewer's franchise org chart (coaching tree + scouting tree side-by-side, with unfilled seats marked as such). Returns `Optional<CoachingStaffOrgChartView>`.
- `ViewStaffRecap` — load the league-wide `ASSEMBLING_STAFF` recap with the viewer's team hoisted to the top of the list. Returns `Optional<StaffRecapView>`.

### Shared records / enums

- `TeamStaffMember`, `NewTeamStaffMember` — terminal staff-seat hire (read-side and insert-side).
- `StaffRole` — terminal staff-seat role (HC, OC/DC/ST, position coaches, DoS, college/pro scouts).
- `SpecialtyPosition` — coaching/scouting specialty (QB, RB, WR, ..., EDGE, CB, S, K, P, LS).
- `RoleScope` — autonomy offered for the role: `LOW`, `MEDIUM`, `HIGH`.
- `StaffContinuity` — candidate's preference over subordinate retention: `KEEP_EXISTING`, `BRING_OWN`, `HYBRID`.
- `CoachingStaffOrgChartView` — view-model for the org chart page (coordinator groups + position coaches + scouts).
- `StaffRecapView` — view-model for the recap page (league summary + per-team `TeamStaffTree` list).
- `TeamStaffRepository` — persistence seam used across features to insert terminal hires.

## Internal structure

Flat package.

- `JooqTeamStaffRepository` — the `TeamStaffRepository` adapter.
- `ViewCoachingStaffOrgChartUseCase`, `ViewStaffRecapUseCase` — `@Service` implementations of the view use cases.
- `CoachingStaffController`, `StaffRecapController` — thin `@Controller`s for the two pages.

## Extending

- Adding a new staff role: extend `StaffRole` and update the view-model assemblers in `ViewCoachingStaffOrgChartUseCase` and `StaffRecapView` (exhaustive switches flag the call sites).
- Adding a new view: see [`docs/playbooks/add-a-use-case.md`](../../../../../../docs/playbooks/add-a-use-case.md). Define the interface here (public), the implementation + controller package-private.

## Tests

Tests at `src/test/java/app/zoneblitz/league/staff/`.

- `JooqTeamStaffRepositoryTests` — `@JooqTest` + `@Import(PostgresTestcontainer.class)`.
- `StaffRecapControllerTests` — `@WebMvcTest` with `@MockitoBean` for `ViewStaffRecap`.
- `NewTeamStaffMemberBuilder` — test data builder for the insert-side record.

## Design docs

- [`docs/technical/staff-market-implementation.md`](../../../../../../docs/technical/staff-market-implementation.md) — staff-cap + counter-offer blueprint (the rows this feature reads are produced by that flow).
- [`docs/technical/league-phases.md`](../../../../../../docs/technical/league-phases.md) — `ASSEMBLING_STAFF` phase and how staff rows are stamped.
- [`CLAUDE.md`](../../../../../../CLAUDE.md) — project-wide conventions.
