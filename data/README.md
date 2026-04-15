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
      passing-plays.R # per-dropback outcome tree and yardage
      rushing-plays.R # per-rush yardage and gain-threshold rates
      special-teams.R # FG/punt/kickoff/return-TD distributions
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
- **`passing-plays.json`** — per-dropback outcome tree and yardage
  distributions. Captures the rate at which a pass attempt resolves to
  complete/incomplete/sack/interception/scramble (overall and broken out by
  down/distance bucket), plus conditional yardage distributions (completion
  yards, sack yards, scramble yards, air yards, YAC), plus big-play rates (20+
  and 40+ yard completions). This is the direct calibration source for the pass
  branch of the sim's play synthesizer.
- **`rushing-plays.json`** — per-rush yardage distribution overall, by
  down/distance bucket, and by field zone (own_deep / own_side / opp_side /
  red_zone_outer / red_zone_inner), plus stuff rate, gain-threshold rates
  (5+/10+/20+/40+), touchdown rate, and fumble rates. Direct calibration source
  for the rush branch of the sim's play synthesizer.
- **`special-teams.json`** — field goal success rate by distance bucket (<30,
  30-39, 40-49, 50+), punt outcome distributions (gross yards, touchback/fair
  catch/inside-20/blocked rates, return yards), kickoff outcome distributions
  (touchback rate, return yards, return TD rate, out-of-bounds rate), extra
  point success and blocked rates, blocked kick rates across all kick types, and
  return TD rates per team per season (punt and kickoff).

## Planned bands (follow-up work)

These map to
[`docs/product/north-star/game-simulation.md`](../docs/product/north-star/game-simulation.md#calibration)
and are tracked as GitHub issues labeled `ready-for-agent`:

- **Situational rates** (#246) — 4th-down go-for-it by field zone, 2-point
  attempts by score diff, onside kick attempt/recovery rates
- **Position stat concentration** (#248) — RB1/RB2/RB3 carry share, WR1/WR2/slot
  target share, CB1 coverage share
- **Injury rates by position** (#249) — separate source (`nflverse` injury
  tables)

## Why R

The nflverse ecosystem (`nflreadr`, `nflfastR`, `nflseedR`) is R-first. The
community cookbooks, recipes, and pitfall notes are all in R. We use R only at
the data-aggregation boundary; the sim itself is Deno/TypeScript and consumes
the generated JSON.
