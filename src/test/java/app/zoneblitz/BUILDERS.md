# Test data builders

Fluent `.with*()`/`build()` builders for the domain records most often constructed
inline in tests. Prefer these over `new X(...)` in new tests — the defaults are a
plausible valid instance, and named overrides read better than a long positional
argument list. Builders are package-private and co-located with the record they
build; import via `static <pkg>.<Record>Builder.a<Record>`.

## Available builders

| Record | Static factory | Location |
|---|---|---|
| `StaffContract` / `NewStaffContract` | `StaffContractBuilder.aStaffContract()` (also `.buildNew()`) | `app.zoneblitz.league.hiring` |
| `TeamDraft` | `TeamDraftBuilder.aTeamDraft()` | `app.zoneblitz.league.team` |
| `TeamHiringState` | `TeamHiringStateBuilder.aTeamHiringState()` | `app.zoneblitz.league.team` |
| `TeamProfile` | `TeamProfileBuilder.aTeamProfile()` | `app.zoneblitz.league.team` |
| `OfferTerms` | `OfferTermsBuilder.anOfferTerms()` | `app.zoneblitz.league.hiring` |
| `NewTeamStaffMember` | `NewTeamStaffMemberBuilder.aNewTeamStaffMember()` | `app.zoneblitz.league.staff` |

## Examples

```java
// TeamDraft — user-owned draft with default franchise id
var draft = aTeamDraft().withOwnerSubject("user-1").build();
```

```java
// TeamHiringState — SEARCHING for a head coach, override team + interviewees
var state =
    aTeamHiringState()
        .withTeamId(teamId)
        .withInterviewingCandidateIds(candidateId)
        .build();
```

```java
// TeamProfile — large NE market, override just the fields the test cares about
var profile = aTeamProfile().withTeamId(teamId).withClimate(Climate.WARM).build();
```

```java
// OfferTerms — mid-market HC defaults, override compensation
var terms = anOfferTerms().withCompensation("20000000.00").build();
```

```java
// NewTeamStaffMember — HC hired on day 1, override for scout assignments
var member =
    aNewTeamStaffMember()
        .withRole(StaffRole.COLLEGE_SCOUT)
        .withScoutBranch(ScoutBranch.COLLEGE)
        .build();
```

```java
// StaffContract — either the existing-row flavor or the insert-side NewStaffContract
var contract = aStaffContract().withSeasons(1, 5).build();
var insert = aStaffContract().withTeamId(teamId).buildNew();
```

## Adding a new builder

When a new domain record starts getting constructed inline in more than a handful
of tests, add a builder. Follow `StaffContractBuilder` as the template:

- `final class <Record>Builder` (package-private) co-located with the record's tests.
- Static factory `a<Record>()` or `an<Record>()` — use whichever is grammatical.
- One field per record component, initialized to a plausible valid default.
- One `.with<Field>(value)` per field, returning `this` for chaining.
- `.build()` returns the record.
- One-line Javadoc on the class noting that defaults are a plausible valid instance.

Add a row to the table above and a one-line example when you land it.
