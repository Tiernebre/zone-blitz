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
      team-game.R              # per-team-per-game distributions (first-cut)
      passing-plays.R          # per-dropback outcome tree + yardage
      rushing-plays.R          # per-rush yardage + gain thresholds
      special-teams.R          # FG/punt/kickoff/return-TD distributions
      situational.R            # 4th-down, 2-point, and onside kick decision rates
      position-concentration.R # top-k share by position group
      injuries.R               # injury rates by position, severity, and category
      draft-hit-rates.R        # P(multi-year starter | round, position)
      draft-pick-value.R       # Jimmy Johnson / Rich Hill / Chase Stuart curves
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
- **`situational.json`** — situational decision rates for game-management AI
  calibration. Covers 4th-down go-for-it rate and conversion rate by field zone
  and distance bucket, 2-point conversion attempt rate by score differential and
  success rate, onside kick attempt rate by late-game situation (trailing
  margin, last 5 min of Q4) and recovery rate. All metrics are aggregate rates
  with sample counts.
- **`position-concentration.json`** — per-team-season stat concentration by
  position group. For each metric (RB carries, RB/WR/TE targets, QB pass
  attempts, LB tackles, CB defensive snaps), ranks players within the position
  group and computes the share going to the top-1, top-3, and top-5 players.
  Captures the "star concentration" pattern: RB1 averages ~57% of team carries,
  WR1 averages ~38% of WR targets, QB1 averages ~81% of pass attempts. Uses
  `load_player_stats()` for offensive/defensive counting stats and
  `load_snap_counts()` for CB snap share. Mid-season QB changes and injured
  starters are handled naturally — weekly stats are summed per player, so a
  starter who misses games accumulates less and the backup's share rises.
- **`draft-hit-rates.json`** — draft hit-rate bands by round (1-7) × position
  group, derived from `load_draft_picks()` joined to `load_snap_counts()` and
  `load_rosters_weekly()` across the 2013-2020 draft classes (2,037 picks). For
  each bucket: `p_started_16_in_3y`, `p_started_48_in_5y`, `p_all_pro_ever`,
  `p_out_of_league_by_y3`, sample size, and a `sample_warning` flag for buckets
  with n < 30. "Start" is defined as a regular-season game at ≥ 50% offense or
  defense snaps. Season window is 2013-2020 because snap_counts coverage begins
  in 2013 and 2020 is the latest draft with a full 5-year runway. See
  [`docs/draft-hit-rates-by-round.md`](./docs/draft-hit-rates-by-round.md).
- **`draft-pick-value.json`** — three canonical draft-pick trade-value curves
  for picks 1-256: Jimmy Johnson (pick 1 = 3000), Rich Hill (pick 1 = 1000), and
  Chase Stuart AV-based (pick 1 = 34.6). Values reproduce published anchor
  tables rather than being scraped or re-fit. Also includes a normalised copy
  (pick 1 = 1.0 per curve) and the consensus future-pick discount (0.8x per
  year). See
  [`docs/draft-pick-trade-value.md`](./docs/draft-pick-trade-value.md) for
  references and worked examples of real trades.
- **`injuries.json`** — injury rate bands by position, severity, and category.
  Derived from `nflreadr::load_injuries()` joined to
  `nflreadr::load_rosters_weekly()` to determine actual weeks missed (severity
  from roster absence, not game-status designation). Covers: injuries per team
  per game, season-ending rate as % of roster, position-specific injury rates,
  injury category distribution (soft-tissue, knee, ankle, concussion, etc.),
  severity split (0 games / 1 game / 2-3 weeks / 4-7 weeks / season-ending), and
  re-injury rate. Non-injury reports (illness, rest, personal) excluded.

## Planned bands (follow-up work)

These map to
[`docs/product/north-star/game-simulation.md`](../docs/product/north-star/game-simulation.md#calibration)
and are tracked as GitHub issues labeled `ready-for-agent`:

- **Position stat concentration** (#248) — RB1/RB2/RB3 carry share, WR1/WR2/slot
  target share, CB1 coverage share

## Why R

The nflverse ecosystem (`nflreadr`, `nflfastR`, `nflseedR`) is R-first. The
community cookbooks, recipes, and pitfall notes are all in R. We use R only at
the data-aggregation boundary; the sim itself is Deno/TypeScript and consumes
the generated JSON.
