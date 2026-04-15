# `data/` — NFL reference data pipeline

Aggregated NFL data used to calibrate the Zone Blitz simulation. Scripts here
pull real play-by-play data via [`nflreadr`](https://nflreadr.nflverse.com/) and
reduce it to **target bands** the sim's calibration harness can assert against.

If a sim output lands outside one of these bands, the sim is the thing that's
wrong. The bands follow the NFL.

## Layout

```
data/
  R/
    setup.R           # verifies package install, prints versions
    lib.R             # shared helpers (season windows, JSON writer)
    bands/
      team-game.R     # per-team-per-game distributions (first-cut)
  bands/              # generated JSON artifacts — checked in
  cache/              # nflreadr disk cache — gitignored
```

## Requirements

- R 4.3+ on `PATH`
- CRAN packages: `nflreadr`, `dplyr`, `tidyr`, `arrow`, `jsonlite`

Bootstrap:

```sh
Rscript data/R/setup.R
```

## Generating a band

Every band script is a self-contained `Rscript` that takes a season window and
writes a JSON file under `data/bands/`:

```sh
Rscript data/R/bands/team-game.R --seasons 2020:2024
# → data/bands/team-game.json
```

Band artifacts are checked in so the sim's calibration harness can read them
without depending on network or R at test time. Regenerate them when:

- The season window shifts (last 5 seasons is the default "modern NFL" window).
- A new rule change or era shift invalidates the old window.
- A new band is introduced.

## Bands currently produced

- **`team-game.json`** — per-team-per-game offensive aggregates (plays, pass/run
  split, completion %, YPA, YPC, sacks, turnovers, penalties, points). Each
  metric carries mean, standard deviation, and percentile breakpoints
  (p10/p25/p50/p75/p90) plus min/max, across all team-games in the window.

## Planned bands (follow-up work)

These map to
[`docs/product/north-star/game-simulation.md`](../docs/product/north-star/game-simulation.md#calibration):

- Situational rates (4th-down go-for-it by field zone, 2-point attempts by score
  diff, onside kick attempt/recovery rates)
- Special-teams outcomes (FG success by distance bucket, punt net yards
  distribution, kickoff return distribution, return-TD rate)
- Position stat concentration (RB1/RB2/RB3 carry share, WR1/WR2/slot target
  share, CB1 coverage share)
- Injury rates by position (separate source — `nflverse` injury tables)

## Why R

The nflverse ecosystem (`nflreadr`, `nflfastR`, `nflseedR`) is R-first. The
community cookbooks, recipes, and pitfall notes are all in R. We use R only at
the data-aggregation boundary; the sim itself is Deno/TypeScript and consumes
the generated JSON.
