# O2 — stats assembler

**Deps:** F1. **Bands:** none. **Unblocks:** consumer-side stat UIs and persistence.

## Goal

Pure fold over a `Stream<PlayEvent>` into a `GameStats` value: per-player lines, per-team totals, per-drive records, and the game envelope. No side effects, no persistence, no wall-clock.

Two modes:

- `finalize(Stream<PlayEvent>)` — terminal fold; one call, one `GameStats`.
- `incremental()` — returns an immutable `StatsProjection` accumulator; `apply(event)` returns a new projection, `snapshot()` materializes a `GameStats` at any time. Every `apply` is a fresh instance.

## Doc context (read only these ranges)

- `sim-engine.md` lines 588-721 (stats model + `StatsAssembler` seam + attribution rules).

## Owns

All under `src/gamesimulator/java/app/zoneblitz/gamesimulator/output/`:

- `StatsAssembler.java` — public interface.
- `StatsProjection.java` — public interface (immutable accumulator).
- `PlayerGameStats.java` — uniform-across-positions stat-line record.
- `TeamGameStats.java` — team totals record.
- `DriveStats.java` — per-drive record.
- `GameStats.java` — top-level envelope.
- `BoxScoreAssembler.java` — default `StatsAssembler` impl + nested `Projection` record implementing `StatsProjection`.
- `TeamAssignment.java` — input context: `home`/`away` `TeamId` plus `PlayerId → TeamId` map. Consumers supply this since `PlayEvent` doesn't carry it directly.
- `DriveResult.java` — enum: `TD, FG, MISSED_FG, PUNT, TURNOVER_ON_DOWNS, INT, FUMBLE, SAFETY, END_OF_HALF, END_OF_GAME`.

Tests (`src/test/java/app/zoneblitz/gamesimulator/output/`):

- `BoxScoreAssemblerTests` — per-category attribution (pass yards = Σ air + YAC; rush yards; team totals = Σ player totals; sacks, interceptions, penalties, punts, fumbles, kicks, points).
- `StatsProjectionTests` — incremental mode equals terminal mode; each `apply` yields a fresh instance.
- `DriveSegmentationTests` — drive boundaries split on INT, fumble-lost, punt, FG made/missed, TD, end-of-game.

## Forbidden

- Editing `PlayEvent` sealed declaration or any variant body.
- Editing O1 (`PlayNarrator`) or O3 (`PlayEventStore`) files.
- Editing resolver/special-teams code.
- Persistence, jOOQ, HTTP — pure engine only.
- Cross-game aggregates.

## Attribution rules applied

- `PassComplete` → QB: `passAttempts+1`, `passCompletions+1`, `passYards += totalYards`, `longestCompletion = max`. Target: `targets+1`, `receptions+1`, `recYards += totalYards`, `yardsAfterCatch += yac`, `longestReception = max`. Both get TDs on `touchdown`.
- `PassIncomplete` → QB: `passAttempts+1`. Target: `targets+1`. `reason == DROPPED` → target `drops+1`. `reason == BROKEN_UP` with `defender` present → defender `passesDefensed+1`.
- `Sack` → QB: `sacksTaken+1`, `sackYardsLost += yardsLost`. Sackers share `sacks` (`1.0 / sackers.size`).
- `Scramble` → QB: `rushAttempts+1`, `rushYards += yards`, `longestRush = max`, `rushTds` on `touchdown`.
- `Interception` → QB: `passAttempts+1`, `interceptions+1`. Interceptor: `defInterceptions+1`, `intReturnYards += returnYards`, `intTds` on `touchdown`.
- `Run` → carrier: `rushAttempts+1`, `rushYards += yards`, `longestRush = max`, `rushTds` on `touchdown`. Fumble handled below.
- Fumbles → fumbler: `fumbles+1`, `fumblesLost+1` on defense recovery. Recoverer: `fumbleRecoveries+1`, `fumbleReturnYards += returnYards`.
- `FieldGoalAttempt` → kicker: `fgAttempts+1`; `fgMade+1` + `longestFg = max(distance)` on `GOOD`; `blockedKicks+1` on `BLOCKED`.
- `ExtraPoint` → kicker: `xpAttempts+1`; `xpMade+1` on `GOOD`; `blockedKicks+1` on `BLOCKED`.
- `Punt` → punter: `punts+1`, `puntYards += grossYards`, `puntTouchbacks+1` on `TOUCHBACK`. Returner: `puntReturns+1`, `puntReturnYards += returnYards`.
- `Kickoff` → returner: `kickReturns+1`, `kickReturnYards += returnYards`.
- `Penalty` → `committedBy`: `penalties+1`, `penaltyYards += yards`. Team penalty totals use `against`.
- `TwoPointAttempt`, `Kneel`, `Spike`, `Timeout`, `TwoMinuteWarning`, `EndOfQuarter` → no player attribution today.

### Team totals

- `points` is derived from `scoreAfter` of the last event (the authoritative running score).
- `passingYards`, `rushingYards` — sum per-team of the respective player-line fields.
- `turnovers` — INT count + fumbles-lost against the team.
- `sacksFor` — sacks by defenders of this team; `sacksAgainst` — QB `sacksTaken` (in yards lost units) for this team.
- `firstDowns` — count of events with `firstDown == true` attributable to the team.
- Third/fourth-down conversion columns, time-of-possession, red-zone attempts/scores stay zero for now (gaps below).

### Drive segmentation

Drives start at the first offensive event after a possession flip (or at the game's first offensive play). A drive ends on any of:

- `PassComplete.touchdown` / `Run.touchdown` / `Scramble.touchdown` → `TD`
- `Interception` → `INT`
- `Run` / `Sack` with `fumble.defenseRecovered` → `FUMBLE`
- `FieldGoalAttempt.result == GOOD` → `FG`; `MISSED` / `BLOCKED` → `MISSED_FG`
- `Punt` → `PUNT`
- `EndOfQuarter` with `quarter == 2` → `END_OF_HALF`; `quarter >= 4` → `END_OF_GAME`
- Implicit change-of-possession without an explicit ender → previous drive closed as `TURNOVER_ON_DOWNS`.
- `ExtraPoint`, `TwoPointAttempt`, `Kickoff`, `Kneel`, `Spike`, `Timeout`, `TwoMinuteWarning` do not count as drive plays.

## Known gaps (carried forward)

- **Penalty team attribution** uses `TeamAssignment.teamFor(Penalty.against)` for team totals. Drive-offense inference on a penalty-only event is a best-effort; most penalties are bundled inside `underlyingPlay` today.
- **Special-teams detail is thin.** Muff recovery by the kicking team isn't represented; `MUFFED` flags a fumble on the returner but no recoverer.
- **Third/fourth-down conversions** — not computed; resolver doesn't tag conversions explicitly.
- **Time of possession** — defaults to `Duration.ZERO`. Unblock when `ClockModel` (M1) lands.
- **Snaps played, QB hits, QB hurries, tackle assists, tackles, tackles for loss** — not emitted by events today. Fields stay 0 until producers supply the detail.
- **Safety detection** — no explicit event; deferred until a `Safety` variant or a dedicated scoring-summary event exists.
- **Red-zone attempts/scores** — depends on drive start/end spots crossing the 20; not computed today while drive spots are approximate (see `preSnapSpot` limitations on special-teams).

## Definition of done

- All tests under `output/` pass.
- `./gradlew spotlessApply && ./gradlew spotlessCheck test` green.
- `git diff --stat` restricted to Owns + this brief + INDEX link update.
