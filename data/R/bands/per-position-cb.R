#!/usr/bin/env Rscript
# per-position-cb.R — NFL CB percentile-band reference.
#
# DATA-FIDELITY CAVEAT (read before trusting this fixture):
# `nflreadr::load_pbp` does *not* include per-play target attribution to
# the covering defender. It does log `pass_defense_1_player_id`,
# `pass_defense_2_player_id`, and `interception_player_id` when a CB
# breaks up or picks off a pass — but completed catches / targets are
# only attributed to the receiver, not the defender. Per-CB
# "completion % allowed" and "yards per target allowed" therefore
# cannot be derived from the free nflverse PBP feed and would require
# FTN charting / PFF coverage data to be joined in. This script
# records those two metrics as NA in each band so the fixture slot
# still exists (and any future data source can drop values in), but
# ranks and bands CBs on the signals PBP *does* give us: PBUs + INTs
# per game, plus interception rate per pass-defense touch.
#
# Pipeline:
#   1. Load regular-season pbp for the requested seasons.
#   2. Pull CB gsis_ids from `load_rosters` (depth_chart_position == CB).
#   3. For each (player, season) count PBUs (appearances in
#      pass_defense_1_player_id or pass_defense_2_player_id) and INTs
#      (appearances in interception_player_id).
#   4. Load snap counts, join on (season, player via roster gsis_id →
#      pfr_player_id), and keep CBs with defense_snaps >= 500 as the
#      starter population.
#   5. Rank by (pbus + 2 * ints) / games played — a crude pass-defense
#      event rate that correlates with the coverage-stat ranks PFF
#      publishes — then carve percentile bands per issue #496.
#
# Output: data/bands/per-position/cb.json
#
# Usage:
#   Rscript data/R/bands/per-position-cb.R [--seasons 2020:2024]

suppressPackageStartupMessages({
  library(nflreadr)
  library(dplyr)
})

script_file <- (function() {
  args <- commandArgs(trailingOnly = FALSE)
  f <- grep("^--file=", args, value = TRUE)
  if (length(f) > 0) normalizePath(sub("^--file=", "", f[1]), mustWork = FALSE) else NULL
})()
source(file.path(dirname(script_file), "..", "lib.R"))

args <- commandArgs(trailingOnly = TRUE)
seasons <- parse_seasons(args)

cat("Loading pbp for seasons:", paste(range(seasons), collapse = "-"), "\n")

pbp <- nflreadr::load_pbp(seasons) |>
  filter(season_type == "REG")

rosters <- nflreadr::load_rosters(seasons) |>
  filter(depth_chart_position == "CB") |>
  select(season, gsis_id, pfr_id, full_name) |>
  distinct(season, gsis_id, .keep_all = TRUE)

snaps <- nflreadr::load_snap_counts(seasons) |>
  filter(position == "CB", game_type == "REG") |>
  group_by(season, pfr_player_id) |>
  summarise(defense_snaps = sum(defense_snaps, na.rm = TRUE),
            games = n(),
            .groups = "drop")

# PBUs: any pass-defense slot that lists the defender.
pbu_events <- pbp |>
  filter(!is.na(pass_defense_1_player_id)) |>
  transmute(season, defender_id = pass_defense_1_player_id,
            event = "pbu", game_id)
pbu_events_2 <- pbp |>
  filter(!is.na(pass_defense_2_player_id)) |>
  transmute(season, defender_id = pass_defense_2_player_id,
            event = "pbu", game_id)
int_events <- pbp |>
  filter(!is.na(interception_player_id), interception == 1) |>
  transmute(season, defender_id = interception_player_id,
            event = "int", game_id)

all_events <- bind_rows(pbu_events, pbu_events_2, int_events)

cb_season <- all_events |>
  inner_join(rosters, by = c("season", "defender_id" = "gsis_id")) |>
  group_by(season, defender_id, full_name, pfr_id) |>
  summarise(
    pbus = sum(event == "pbu"),
    ints = sum(event == "int"),
    games_with_events = n_distinct(game_id),
    .groups = "drop"
  ) |>
  inner_join(snaps, by = c("season", "pfr_id" = "pfr_player_id")) |>
  filter(defense_snaps >= 500) |>
  mutate(
    pbus_per_game = ifelse(games > 0, pbus / games, NA_real_),
    ints_per_game = ifelse(games > 0, ints / games, NA_real_),
    pass_defense_events = pbus + ints,
    event_rate = ifelse(games > 0,
                        (pbus + 2 * ints) / games,
                        NA_real_),
    # Slots for metrics we can't derive from free PBP. Downstream
    # calibration treats `n == 0` bands as "no reference" and skips
    # the comparison.
    completion_allowed_pct = NA_real_,
    yards_per_target_allowed = NA_real_,
    targets_per_game = NA_real_,
    pbu_rate = NA_real_
  )

cat("CB-seasons after starter filter:", nrow(cb_season), "\n")

cb_ranked <- cb_season |>
  arrange(desc(event_rate)) |>
  mutate(
    pct = (row_number() - 0.5) / n(),
    band = case_when(
      pct <= 0.10 ~ "elite",
      pct <= 0.30 ~ "good",
      pct <= 0.70 ~ "average",
      pct <= 0.90 ~ "weak",
      TRUE        ~ "replacement"
    )
  )

metric_keys <- c(
  "targets_per_game",
  "completion_allowed_pct",
  "yards_per_target_allowed",
  "pbu_rate",
  "pbus_per_game",
  "ints_per_game"
)

band_order <- c("elite", "good", "average", "weak", "replacement")

band_summary <- function(rows) {
  metrics <- list()
  for (key in metric_keys) {
    vals <- rows[[key]]
    vals <- vals[!is.na(vals)]
    if (length(vals) == 0) {
      # Emit zero-n placeholder so the fixture schema stays consistent
      # across positions; calibration code treats n=0 as "no reference".
      metrics[[key]] <- list(n = 0L, mean = 0, sd = 0)
    } else {
      metrics[[key]] <- list(
        n = length(vals),
        mean = mean(vals),
        sd = stats::sd(vals)
      )
    }
  }
  list(
    n = nrow(rows),
    metrics = metrics
  )
}

bands <- list()
for (band_name in band_order) {
  rows <- cb_ranked |> filter(band == band_name)
  bands[[band_name]] <- band_summary(rows)
}

out <- list(
  generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
  seasons = as.integer(seasons),
  position = "CB",
  qualifier = "regular-season CB-seasons with >=500 defensive snaps",
  ranking_stat = "event_rate ((pbus + 2*ints) / games)",
  notes = paste0(
    "Starter CB-seasons 2020-2024, ranked by (pbus + 2*ints)/game then ",
    "carved into percentile bands (elite: top 10%, good: 10-30%, average: ",
    "30-70%, weak: 70-90%, replacement: bottom 10%). ",
    "DATA GAP: nflverse PBP does not attribute completed targets to ",
    "covering defenders, so completion_allowed_pct, yards_per_target_allowed, ",
    "targets_per_game, and pbu_rate are emitted as n=0 placeholders. The ",
    "calibration harness treats n=0 bands as 'no reference' and skips the ",
    "check. PBUs/ints per game are the two metrics with real NFL grounding ",
    "in this fixture; joining FTN or PFF coverage data is the follow-up."
  ),
  bands = bands
)

out_path <- file.path(
  repo_root(), "data", "bands", "per-position", "cb.json"
)
dir.create(dirname(out_path), recursive = TRUE, showWarnings = FALSE)
writeLines(
  jsonlite::toJSON(out, auto_unbox = TRUE, pretty = TRUE, digits = 4,
                   null = "null"),
  out_path
)
cat("Wrote", out_path, "\n")
