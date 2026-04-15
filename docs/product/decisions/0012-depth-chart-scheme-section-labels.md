# 0012 — Depth chart section labels surface the scheme

- **Date:** 2026-04-14
- **Status:** Accepted — builds on
  [`0001-roster-page.md`](./0001-roster-page.md),
  [`0005-schemes-page-removal.md`](./0005-schemes-page-removal.md), and
  [`0006-positionless-players.md`](./0006-positionless-players.md).
- **Area:** roster, depth chart, schemes — see
  [`../north-star/schemes-and-strategy.md`](../north-star/schemes-and-strategy.md)
  and [`../north-star/game-simulation.md`](../north-star/game-simulation.md).

## Context

The depth chart vocabulary is already scheme-driven via
`packages/shared/depth-chart/vocabulary.ts` — an even-front DC surfaces
`DE / DT / LB`, an odd-front DC surfaces `OLB / DE / NT / ILB`, a hybrid DC
surfaces `EDGE / DL / LB`, and offensive personnel weight decides whether `FB`
appears. That work is correct; the product problem is that the row labels alone
don't tell the user _which_ scheme they're looking at. A `DE` row in a 3-4 is a
5-technique; a `DE` row in a 4-3 is an edge rusher. Same code, dramatically
different player shape. Today the roster page renders only "Offense" and
"Defense" as group headers, so the user has to infer the scheme from the row
mix.

ESPN's depth chart solves this with section headers that carry the scheme
explicitly: "Base 3-4 D", "Base 4-3 D", "3WR 1TE" (e.g.
[Seattle](https://www.espn.com/nfl/team/depth/_/name/sea),
[Chicago](https://www.espn.com/nfl/team/depth/_/name/chi)). Row labels stay
short; the header disambiguates them.

## Decision

Surface the scheme as **section labels** on the depth chart, derived from the
same `SchemeFingerprint` that already drives the slot vocabulary. Row labels do
not change. No data model change.

### Label derivation

Two new exports from `packages/shared/depth-chart/vocabulary.ts`, computed from
the fingerprint using the thresholds already encoded in that module:

**Defense label** (from `defense.frontOddEven`, same thresholds as slot
selection):

| Condition           | Label          |
| ------------------- | -------------- |
| `frontOddEven ≥ 56` | `Base 3-4`     |
| `frontOddEven ≤ 45` | `Base 4-3`     |
| otherwise (46–55)   | `Hybrid Front` |

If `defense.subPackageLean ≥ 56` (same threshold that adds the `NCB` slot),
append `· Nickel` to the defense label. Example: `Base 3-4 · Nickel`.

**Offense label** (from `offense.personnelWeight`, same thresholds as slot
selection):

| Condition              | Label          |
| ---------------------- | -------------- |
| `personnelWeight ≥ 66` | `21 Personnel` |
| `personnelWeight ≤ 45` | `10 Personnel` |
| otherwise (46–65)      | `11 Personnel` |

**Special teams label** is static: `Special Teams`. No scheme variance.

**No fingerprint available** (no OC / no DC — the `DEFAULT_OFFENSE` /
`DEFAULT_DEFENSE` fallback): the label is `Offense` / `Defense` with no scheme
suffix. Cold-start teams don't get a fake scheme badge.

### Where the labels render

- Roster page depth chart view (`client/src/features/league/roster.tsx`) —
  replaces the plain "Offense" / "Defense" group headers. This is the only v1
  consumer.

Other consumers of the vocabulary (server publisher, repository) keep consuming
slot definitions; they do not need the label string.

## Alternatives considered

- **Disambiguate inside the row label (e.g. rename 3-4 `DE` to `DE-5T` or
  `5T`).** Rejected. It solves the ambiguity at the cost of breaking
  recognisability — users read "DE" instantly; "5T" takes a beat and reads as
  jargon. Section-header context preserves both.
- **Always show both "Offense" and "Defense" plus a separate scheme badge
  elsewhere on the page.** Rejected as redundant — the group header is the
  natural anchor, and a separate badge adds surface without adding information.
- **Derive labels from coach identity / name (e.g. "Belichick 3-4") rather than
  fingerprint.** Rejected. The fingerprint is the single source of truth for
  "what scheme is this"; coach names are flavor, not canonical.

## Consequences

- One shared helper, two consumers (the existing scheme-lens work in ADR 0006
  gets a precedent for how lens output surfaces in the UI).
- Label strings are English-only for now; i18n is out of scope (no i18n exists
  elsewhere in the app yet).
- Threshold changes in `vocabulary.ts` (e.g. tuning `ODD_FRONT_THRESHOLD`)
  automatically re-label; the label function must read the same constants, not
  duplicate them.
- Users looking at their own roster immediately see whether the DC is running an
  odd or even front, without having to read the row mix. On other teams' rosters
  (positionless ADR 0006 neutral-lens view), the scheme label continues to come
  from _that_ team's fingerprint, which is correct — it tells the user what
  they're scouting against.
