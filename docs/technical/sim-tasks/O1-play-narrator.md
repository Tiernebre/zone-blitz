# O1 — play narrator

**Deps:** F1. **Unblocks:** play-by-play UI rendering and any historical replay tooling that reads from `PlayEventStore`.

## Goal

Turn the engine's structured `PlayEvent` stream into concise, present-tense English play-by-play strings. Narration is a **separate layer** from the engine: events remain pure data, and `PlayNarrator` is a pure function of `PlayEvent + NarrationContext`. No RNG, no I/O, no state.

With this task in place, both quick-sim (fold events into a box score and drop the text) and play-by-play (render every event) read the same source of truth.

## Doc context

- `sim-engine.md` lines 474-584 (event stream, narrator contract, sealed variants, `NarrationContext` role).

## Owns

- `src/gamesimulator/java/app/zoneblitz/gamesimulator/output/PlayNarrator.java` — public interface + `defaultNarrator()` factory.
- `src/gamesimulator/java/app/zoneblitz/gamesimulator/output/NarrationContext.java` — record carrying `PlayerId → name` and `Side → team name` resolvers.
- `src/gamesimulator/java/app/zoneblitz/gamesimulator/output/DefaultPlayNarrator.java` — package-private exhaustive-switch implementation.
- `src/test/java/app/zoneblitz/gamesimulator/output/DefaultPlayNarratorTests.java` — at least one test per `PlayEvent` variant plus situation edge cases.

## Forbidden

- Editing `PlayEvent` sealed declaration or any variant record body. F1 owns the union; later task owners (F1 / ST) own variant fields.
- Touching resolver / special-teams / stats code.
- Adding any dependency on Spring inside `gamesimulator/` — the source set stays framework-free.
- Introducing RNG, I/O, or mutable state into the narrator.

## Key design notes

- **Pure function.** `narrate(PlayEvent, NarrationContext) → String`. Same inputs, same output, always. Calibration and replay depend on that.
- **Exhaustive sealed switch** with `case null` for `PlayEvent`; the compiler guarantees a formatter exists for every variant. Adding a new variant forces a compile break here.
- **IDs → names at render time.** Events reference `PlayerId` / `Side`; `NarrationContext` resolves them. Unknown ids fall back to `"unknown"` so a stale roster never crashes rendering.
- **Situation prefix** — `(Q1 15:00 3rd-4, own 25)` — is produced uniformly from `preSnap`, `preSnapSpot`, and `clockBefore`. Overtime is labelled `OT` / `OT2` / ….
- **Field spot formatting** — yard line 0..50 → `own N`, 51..100 → `opp N` (where N = 100 − yardLine). Goal-line spots become `opp 1` / `opp 0`.
- **Terse on purpose.** "Mahomes to Kelce for 14. 1ST DOWN. Ball at own 39." beats prose. Calibration asserts on substrings, not poetry.
- **Style swapping later is free.** Any ESPN-style / radio / localized narrator is a second implementation of the same interface; the engine never changes.

## Tests

Per variant (one unit test each covering `PassComplete`, `PassIncomplete`, `Sack`, `Scramble`, `Interception`, `Run`, `FieldGoalAttempt`, `ExtraPoint`, `TwoPointAttempt`, `Punt`, `Kickoff`, `Penalty`, `Kneel`, `Spike`, `Timeout`, `TwoMinuteWarning`, `EndOfQuarter`). Plus situational coverage:

- First down / touchdown tagging on `PassComplete` and `Run`.
- Fumble suffix on `Sack`.
- Slide-or-OOB on `Scramble`.
- Pick-six on `Interception`.
- Field-goal `GOOD` / `BLOCKED` (names the blocker).
- Onside kickoff.
- Penalty renders type, team side, player, yards, replay-down flag.
- 4th-and-goal situation prefix.
- Halftime / end-of-regulation / overtime clock labelling.
- Unknown-player fallback returns `"unknown"` instead of throwing.
- Null event / null context → `NullPointerException`.

## Known gaps

Variants currently in the sealed union are mostly records owned by F1 / later task authors; narration works at the best fidelity current fields expose. Notable gaps to revisit when those fields grow:

- **Possession side isn't on `PlayEvent`.** The narrator can't say "Chiefs offense" vs "Raiders offense" without guessing. `NarrationContext.teamName(Side)` is still wired so penalty and timeout narration can name sides. Once a `possession` field lands on `PlayEvent`, the situation prefix should include the offense short name.
- **`Kneel` / `Spike` / `TwoMinuteWarning` / `EndOfQuarter` carry no participant info.** Narration is therefore generic ("Kneel down.", "Two-minute warning, Q2."). Fine for now.
- **`Penalty.underlyingPlay` is not recursed into.** Chained narration ("holding on the pass that went to Kelce for 14") is deferred until we see real composite scenarios in the calibration runs.
- **`Run.rngDraw` is ignored** — it's a determinism hook for resolvers, not something to surface to readers.
- **`Kickoff.preSnap.down == 0`** is handled by dropping the down/distance segment from the situation prefix. When a dedicated `KickoffState` eventually replaces the borrowed fields, simplify the switch.

## Definition of done

- All tests under `DefaultPlayNarratorTests` pass.
- `./gradlew spotlessApply && ./gradlew spotlessCheck test` green.
- `git diff --stat` restricted to **Owns** plus this brief.
