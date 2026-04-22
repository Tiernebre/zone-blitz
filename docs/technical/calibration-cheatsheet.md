# Calibration cheatsheet

Quick-reference snippets for answering "what does the real NFL do for X?" during a conversation — before calibrating a sim knob, writing a new band, or challenging a number someone guessed.

Two sources, two tools:

| Source | Tool | What it answers | Skill |
|---|---|---|---|
| Play-by-play (pbp) | `nflreadr` (R) | Down/distance/field-zone outcomes, 4th-down go rates, penalty counts, YPC/YPA, completion rates, positional aggregates. | [`nflfastr`](./../../CLAUDE.md#external-resources) |
| Player tracking (10 Hz x/y/speed) | `kaggle` + Python | Routes, coverages, pressure, formations, time-to-throw, pre-/post-snap flips. | [`bigdatabowl`](./../../CLAUDE.md#external-resources) |

Always prefer these over guessing when calibrating sim models. The skills wrap the detail — this page is the "what do I paste" companion.

Existing production band scripts under [`data/R/bands/`](../../data/R/bands/) and [`data/bigdatabowl/`](../../data/bigdatabowl/) are the best templates when an ad-hoc question turns into a persistent band.

---

## nflfastr: ad-hoc pbp queries

Scratch directory pattern — don't add one-off scripts to `data/R/bands/` unless the band is going to be checked in.

```sh
# From repo root. Seasons default to what the sim currently calibrates against.
Rscript -e '
suppressPackageStartupMessages(library(nflreadr))
suppressPackageStartupMessages(library(dplyr))
pbp <- load_pbp(2020:2024)
# ... your one-off query here ...
'
```

### Canonical snippets

**4th-down go rate by distance**

```r
pbp |>
  filter(down == 4, !is.na(yardline_100), play_type %in% c("pass","run","punt","field_goal")) |>
  mutate(went_for_it = play_type %in% c("pass","run")) |>
  group_by(ydstogo_band = cut(ydstogo, c(0,1,2,3,5,10,Inf))) |>
  summarise(n = n(), go_rate = mean(went_for_it), .groups = "drop")
```

**Completion percentage by depth**

```r
pbp |>
  filter(play_type == "pass", !is.na(air_yards)) |>
  mutate(depth = cut(air_yards, c(-Inf, 0, 10, 20, Inf),
                     labels = c("behind","short","intermediate","deep"))) |>
  group_by(depth) |>
  summarise(n = n(), comp_pct = mean(complete_pass, na.rm = TRUE), .groups = "drop")
```

**Yards per rush by field zone**

```r
pbp |>
  filter(rush_attempt == 1, !is.na(yards_gained), qb_kneel == 0, qb_spike == 0) |>
  mutate(zone = case_when(
    yardline_100 <= 10 ~ "red_zone",
    yardline_100 <= 40 ~ "opp_territory",
    yardline_100 <= 60 ~ "midfield",
    TRUE               ~ "backed_up")) |>
  group_by(zone) |>
  summarise(n = n(), ypc = mean(yards_gained), .groups = "drop")
```

**Per-team penalty counts by type** (base for `per-position-penalty-rates.R`)

```r
pbp |>
  filter(penalty == 1, !is.na(penalty_type), !is.na(penalty_team)) |>
  count(penalty_team, penalty_type, sort = TRUE)
```

### Key `pbp` columns

`season`, `game_id`, `play_id`, `down`, `ydstogo`, `yardline_100`, `play_type` (`run`/`pass`/`punt`/`field_goal`/`kickoff`/`no_play`), `pass_attempt`, `rush_attempt`, `complete_pass`, `air_yards`, `yards_after_catch`, `yards_gained`, `touchdown`, `interception`, `fumble_lost`, `sack`, `qb_hit`, `pressure`, `epa`, `wp`, `penalty`, `penalty_type`, `penalty_team`, `penalty_yards`, `posteam`, `defteam`, `qb_kneel`, `qb_spike`.

Schema reference: <https://nflreadr.nflverse.com/articles/dictionary_pbp.html> (don't fetch in a loop — pull once, cache).

### Tips

- `load_pbp()` caches under `data/cache/` (gitignored). First season-window pull is slow; subsequent identical calls are instant.
- Use `parse_seasons()` from [`data/R/lib.R`](../../data/R/lib.R) if writing a persistent script — it consumes the `--seasons` CLI flag consistently with the other bands.
- When the answer is needed as JSON for a sim test band, copy an existing `data/R/bands/*.R` script and use its `write_band(...)` helper. Don't hand-roll the envelope.

---

## bigdatabowl: ad-hoc tracking queries

The tracking archive lives under `$BDB_DATA_ROOT` (default `~/data/bigdatabowl/`). The `bigdatabowl` skill handles download via `kaggle`. Helpers in [`data/bigdatabowl/lib.py`](../../data/bigdatabowl/lib.py) (`rate_distribution`, `distribution_summary`, band-envelope writers) mirror the R helpers.

Scratch pattern:

```sh
# From repo root.
uv run --with pandas --with pyarrow python - <<'PY'
import pandas as pd, os
from pathlib import Path
ROOT = Path(os.environ.get("BDB_DATA_ROOT", Path.home() / "data" / "bigdatabowl"))
plays = pd.read_csv(ROOT / "plays.csv")
# tracking is one file per week: tracking_week_1.csv ... tracking_week_18.csv
tracking = pd.concat(
    pd.read_parquet(p) for p in (ROOT / "parquet").glob("tracking_week_*.parquet")
)
# ... query ...
PY
```

### Canonical snippets

**Time to throw distribution under pressure vs. no pressure**

```python
pass_plays = plays[plays["passResult"].isin(["C","I","IN","S"])]
throws = tracking[tracking["event"].isin(["pass_forward","sack"])]
snaps  = tracking[tracking["event"] == "ball_snap"]
time_to = (throws.groupby(["gameId","playId"])["frameId"].min()
           - snaps.groupby(["gameId","playId"])["frameId"].min()) / 10
```

**Man vs. zone post-snap flip rate**

Start from the annotated coverage frames, group by `(gameId, playId)`, compare the pre-snap coverage label against the label at the throw/sack frame. See `data/bigdatabowl/coverage_shell.py` for the coverage-frame extraction template.

**Formation distribution at the snap**

```python
snap_frames = tracking[tracking["event"] == "ball_snap"].merge(plays, on=["gameId","playId"])
# box count = defenders within 8 yards of LOS
```

See `data/bigdatabowl/formation_box.py` for the full template.

### Key files

- `plays.csv` — one row per play with down/distance, formation, personnel, pass result, EPA.
- `players.csv` — roster with height/weight/position.
- `games.csv` — one row per game with week, teams, date.
- `tracking_week_N.csv` — 10 Hz frames, one row per (player, frame).
- Annotations vary by year's competition (coverage labels, pressure frames). Check the competition's README under `$BDB_DATA_ROOT`.

### Tips

- Convert CSV tracking to Parquet once (`pd.read_csv(...).to_parquet(...)`). 10× faster for repeated queries, 1/4 the disk.
- Filter on `(gameId, playId)` before joining tracking to plays — the tracking table is large enough that a naive merge blows memory.
- Frames: `event == "ball_snap"` is `t=0`; throw is `pass_forward`; end-of-play is `pass_outcome_*`, `tackle`, or `out_of_bounds`. Kneels have no snap event.

---

## When to promote a query into a band

- It's answering a question the sim's calibration harness should re-check — i.e. if the sim output drifts outside this distribution, the sim is wrong.
- The query will be re-run against newer seasons.
- The output is checked into `data/bands/` as JSON.

If yes: copy the closest existing script in `data/R/bands/` (or `data/bigdatabowl/`) as a template, add a band writer using the shared lib, and document the source/period/filter choices in the script header. See [`data/README.md`](../../data/README.md) for the full contribution pattern.
